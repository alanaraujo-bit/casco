'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import {
  caixaMovimentos,
  clientes,
  contasBancarias,
  contasReceber,
  formasPagamento,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { dataNaLoja } from '@/lib/formatos'
import { centavos, deCentavos } from '@/modules/vendas/esquema'
import {
  CAMPOS_BAIXA,
  esquemaBaixa,
  type CampoBaixa,
  type EstadoBaixa,
} from './esquema'

/**
 * As duas escritas de Contas a Receber: dar baixa e desfazer a baixa.
 *
 * **Baixar um título é sempre duas linhas.** O título muda de estado *e* o
 * dinheiro entra no caixa, na mesma transação. Separar as duas coisas é o que
 * faz o Fluxo de Caixa do sistema antigo divergir do Contas a Receber: lá a
 * operadora marca o título como recebido numa tela e lança o caixa em outra, e
 * basta ela ser interrompida no meio para as duas telas passarem o mês
 * discordando.
 *
 * **Desfazer não apaga.** O movimento de caixa da baixa não é removido: lança-se
 * a saída oposta, com a descrição dizendo o que aconteceu. É a mesma regra do
 * vasilhame — e vale mais ainda aqui, porque o dia em que alguém perguntar "esse
 * dinheiro entrou ou não?", a resposta precisa estar no extrato, não na ausência
 * de uma linha que ninguém sabe que existiu.
 */

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoBaixa, string>,
  tentativa: number,
): EstadoBaixa {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoBaixa, string>> = {}
  for (const campo of CAMPOS_BAIXA) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  const geral = z.flattenError(erro).formErrors[0]
  return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
}

function mensagemDoBanco(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err)
  if (texto.includes('contas_receber_baixa_completa'))
    return 'Baixa pela metade não é aceita: ou tem data e valor, ou não tem baixa.'
  return 'Não foi possível dar baixa no título. Nada foi gravado — pode tentar de novo.'
}

function revalidarTudo() {
  revalidatePath('/financeiro/receber')
  revalidatePath('/financeiro/caixa')
  revalidatePath('/vendas/produtos')
  revalidatePath('/painel')
}

export async function receberTitulo(
  anterior: EstadoBaixa,
  form: FormData,
): Promise<EstadoBaixa> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = Object.fromEntries(
    CAMPOS_BAIXA.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoBaixa, string>

  const analise = esquemaBaixa.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      /**
       * O título é relido **e travado** aqui. `for update` não é preciosismo:
       * duas abas abertas no mesmo título — que é o que acontece quando a
       * operadora não lembra se já baixou — dariam duas baixas e duas entradas
       * de caixa para um dinheiro que entrou uma vez só.
       *
       * A trava vai numa consulta **sem `join`**, e isso não é estilo: o
       * Postgres recusa `for update` sobre o lado anulável de um outer join
       * ("FOR UPDATE cannot be applied to the nullable side of an outer join"),
       * e a recusa chegava na tela como "não foi possível dar baixa". O nome do
       * cliente vem depois, numa leitura separada — ele é texto de recibo, e
       * travar a linha do cliente não protegeria nada aqui.
       */
      const [titulo] = await tx
        .select({
          id: contasReceber.id,
          codigo: contasReceber.codigo,
          clienteId: contasReceber.clienteId,
          valorParcela: contasReceber.valorParcela,
          pagoEm: contasReceber.pagoEm,
          descricao: contasReceber.descricao,
        })
        .from(contasReceber)
        .where(eq(contasReceber.id, dados.tituloId))
        .limit(1)
        .for('update')

      if (!titulo) return { erro: 'Título não encontrado.', valores, tentativa }

      let clienteNome: string | null = null
      if (titulo.clienteId) {
        const [pessoa] = await tx
          .select({ nome: clientes.nome })
          .from(clientes)
          .where(eq(clientes.id, titulo.clienteId))
          .limit(1)
        clienteNome = pessoa?.nome ?? null
      }
      if (titulo.pagoEm) {
        return {
          erro: 'Este título já foi recebido. Recarregue a tela para ver a baixa.',
          valores,
          tentativa,
        }
      }

      const [forma] = await tx
        .select({
          id: formasPagamento.id,
          nome: formasPagamento.nome,
          taxaPercentual: formasPagamento.taxaPercentual,
        })
        .from(formasPagamento)
        .where(and(eq(formasPagamento.id, dados.formaId), eq(formasPagamento.ativo, true)))
        .limit(1)
      if (!forma) return { campos: { formaId: 'Forma não encontrada' }, valores, tentativa }

      const [conta] = await tx
        .select({ id: contasBancarias.id, nome: contasBancarias.nome })
        .from(contasBancarias)
        .where(and(eq(contasBancarias.id, dados.contaId), eq(contasBancarias.ativo, true)))
        .limit(1)
      if (!conta) return { campos: { contaId: 'Conta não encontrada' }, valores, tentativa }

      const pago = centavos(dados.valorPago)
      // Mesma conta do PDV: a taxa sai da forma, nunca é digitada. Digitada, ela
      // vira o campo que a operadora deixa em branco com pressa.
      const taxa = Math.round((pago * Number(forma.taxaPercentual)) / 100)
      const liquido = pago - taxa
      const cobrado = centavos(Number(titulo.valorParcela))

      await tx
        .update(contasReceber)
        .set({
          pagoEm: dados.pagoEm,
          valorPago: deCentavos(pago).toFixed(2),
          contaId: conta.id,
          formaId: forma.id,
          taxas: deCentavos(taxa).toFixed(2),
        })
        .where(eq(contasReceber.id, titulo.id))

      await tx.insert(caixaMovimentos).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        contaId: conta.id,
        // A data do caixa é a do pagamento, não a de hoje: título recebido
        // ontem e lançado hoje pertence ao caixa de ontem, senão o fechamento
        // do dia anterior nunca fecha.
        data: dados.pagoEm,
        sentido: 'entrada',
        valor: deCentavos(liquido).toFixed(2),
        categoria: 'Recebimento',
        descricao: `Título ${titulo.codigo ?? ''} · ${clienteNome ?? titulo.descricao ?? 'avulso'}`.trim(),
        origem: 'receber',
        origemId: titulo.id,
        usuarioId: sessao.usuarioId,
      })

      revalidarTudo()

      return {
        tentativa,
        recibo: {
          codigo: titulo.codigo,
          cliente: clienteNome ?? titulo.descricao ?? '—',
          valorPago: deCentavos(pago),
          taxa: deCentavos(taxa),
          liquido: deCentavos(liquido),
          conta: conta.nome,
          forma: forma.nome,
          diferenca: deCentavos(cobrado - pago),
        },
      }
    })
  } catch (err) {
    return { erro: mensagemDoBanco(err), valores, tentativa }
  }
}

export interface ResultadoDesfazer {
  ok: boolean
  erro?: string
}

/**
 * Desfaz a baixa: o título volta a ficar em aberto e o caixa recebe a saída
 * oposta, com a descrição explicando.
 *
 * A saída não é "apagar a entrada" — é uma linha nova. Um extrato onde o
 * dinheiro entra e some sem rastro é pior que um extrato com duas linhas que se
 * anulam: no segundo caso dá para reconstruir o que houve.
 */
export async function desfazerBaixa(tituloId: string): Promise<ResultadoDesfazer> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [titulo] = await tx
        .select({
          id: contasReceber.id,
          codigo: contasReceber.codigo,
          pagoEm: contasReceber.pagoEm,
          valorPago: contasReceber.valorPago,
          taxas: contasReceber.taxas,
          contaId: contasReceber.contaId,
        })
        .from(contasReceber)
        .where(eq(contasReceber.id, tituloId))
        .limit(1)
        .for('update')

      if (!titulo) return { ok: false, erro: 'Título não encontrado.' }
      if (!titulo.pagoEm) return { ok: false, erro: 'Este título não está baixado.' }

      const liquido = centavos(Number(titulo.valorPago ?? 0)) - centavos(Number(titulo.taxas))

      if (titulo.contaId && liquido > 0) {
        await tx.insert(caixaMovimentos).values({
          id: uuidv7(),
          companyId: sessao.companyId,
          contaId: titulo.contaId,
          // Data de hoje, e não a do pagamento original: o estorno acontece
          // agora. Datá-lo no passado mudaria um fechamento de caixa que a
          // operadora já conferiu e fechou.
          data: dataNaLoja(),
          sentido: 'saida',
          valor: deCentavos(liquido).toFixed(2),
          categoria: 'Estorno de recebimento',
          descricao: `Baixa desfeita do título ${titulo.codigo ?? ''}`.trim(),
          origem: 'receber',
          origemId: titulo.id,
          usuarioId: sessao.usuarioId,
        })
      }

      await tx
        .update(contasReceber)
        // Os dois juntos, sempre: o check constraint recusa metade.
        .set({ pagoEm: null, valorPago: null, taxas: '0' })
        .where(and(eq(contasReceber.id, titulo.id), isNotNull(contasReceber.pagoEm)))

      revalidarTudo()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: mensagemDoBanco(err) }
  }
}
