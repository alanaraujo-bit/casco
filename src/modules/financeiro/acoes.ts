'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import {
  caixaAberturas,
  caixaMovimentos,
  clientes,
  contasBancarias,
  contasPagar,
  contasReceber,
  formasPagamento,
  fornecedores,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha, type Falha } from '@/lib/erros'
import { autorDoLancamento } from '@/lib/sessao'
import { marcarMudanca } from '@/modules/sincronizacao/servidor'
import { dataNaLoja } from '@/lib/formatos'
import { centavos, deCentavos } from '@/modules/vendas/esquema'
import {
  CAMPOS_ABERTURA_CAIXA,
  CAMPOS_BAIXA,
  CAMPOS_CONTA,
  CAMPOS_FORMA,
  CAMPOS_PAGAR,
  CAMPOS_QUITAR,
  esquemaAberturaCaixa,
  esquemaBaixa,
  esquemaConta,
  esquemaForma,
  esquemaPagar,
  esquemaQuitar,
  type CampoAberturaCaixa,
  type CampoBaixa,
  type CampoConta,
  type CampoForma,
  type CampoPagar,
  type CampoQuitar,
  type EstadoAberturaCaixa,
  type EstadoBaixa,
  type EstadoConta,
  type EstadoForma,
  type EstadoPagar,
  type EstadoQuitar,
} from './esquema'

/**
 * As duas escritas de Contas a Receber: dar baixa e desfazer a baixa.
 *
 * **Baixar um título é sempre duas linhas.** O título muda de estado *e* o
 * dinheiro entra no caixa, na mesma transação. Separar as duas coisas é o que
 * faz o Fluxo de Caixa divergir do Contas a Receber: se a
 * operadora marca o título como recebido numa tela e lança o caixa em outra,
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
        usuarioId: autorDoLancamento(sessao),
      })

      await marcarMudanca(tx, sessao.companyId)
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
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

export interface ResultadoDesfazer {
  ok: boolean
  erro?: Falha | string
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
          usuarioId: autorDoLancamento(sessao),
        })
      }

      await tx
        .update(contasReceber)
        // Os dois juntos, sempre: o check constraint recusa metade.
        .set({ pagoEm: null, valorPago: null, taxas: '0' })
        .where(and(eq(contasReceber.id, titulo.id), isNotNull(contasReceber.pagoEm)))

      await marcarMudanca(tx, sessao.companyId)
      revalidarTudo()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: descreverFalha(err) }
  }
}

/* --------------------------------------------------------- contas a pagar */

function revalidarPagar() {
  revalidatePath('/financeiro/pagar')
  revalidatePath('/financeiro/caixa')
  revalidatePath('/painel')
}

/**
 * O vencimento da parcela `n`: o da primeira, mais `n` meses.
 *
 * Somado em **mês de calendário** e não em 30 dias. Boleto vence "todo dia 10";
 * com 30 dias o vencimento andaria para o dia 9, depois 8, e em um ano a conta
 * estaria vencendo dez dias antes do combinado. O dia 31 num mês de 30 volta
 * para o último dia do mês pretendido, que é o que qualquer banco faz.
 */
function vencimentoDaParcela(primeiro: string, indice: number): string {
  const [ano, mes, dia] = primeiro.split('-').map(Number)
  const alvoMes = mes - 1 + indice
  const data = new Date(Date.UTC(ano, alvoMes, dia))
  if (data.getUTCMonth() !== ((alvoMes % 12) + 12) % 12) data.setUTCDate(0)
  return data.toISOString().slice(0, 10)
}

/**
 * Lança uma despesa ou custo, em uma ou várias parcelas.
 *
 * **Uma parcela é uma linha.** Um boleto de R$ 1.200 em 3× vira três contas de
 * R$ 400, cada uma com seu vencimento — e não uma conta de R$ 1.200 com um
 * campo "parcelas" ao lado. É o que faz a pergunta "o que vence esta semana"
 * ter resposta, e é como a listagem já mostra.
 *
 * O resto da divisão vai na última parcela, pelo mesmo motivo do a prazo no PDV.
 */
export async function lancarContaPagar(
  anterior: EstadoPagar,
  form: FormData,
): Promise<EstadoPagar> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = Object.fromEntries(
    CAMPOS_PAGAR.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoPagar, string>

  const analise = esquemaPagar.safeParse(valores)
  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    const campos: Partial<Record<CampoPagar, string>> = {}
    for (const campo of CAMPOS_PAGAR) {
      const msg = porCampo[campo]?.[0]
      if (msg) campos[campo] = msg
    }
    const geral = z.flattenError(analise.error).formErrors[0]
    return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
  }

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      if (dados.fornecedorId) {
        // Relido dentro do tenant: um id de outra distribuidora simplesmente
        // não é encontrado, e a RLS vira validação de autorização de graça.
        const [f] = await tx
          .select({ id: fornecedores.id })
          .from(fornecedores)
          .where(eq(fornecedores.id, dados.fornecedorId))
          .limit(1)
        if (!f) {
          return { campos: { fornecedorId: 'Fornecedor não encontrado' }, valores, tentativa }
        }
      }

      const total = centavos(dados.valorPrevisto)
      const base = Math.floor(total / dados.parcelas)
      const sobra = total - base * dados.parcelas

      await tx.insert(contasPagar).values(
        Array.from({ length: dados.parcelas }, (_, i) => ({
          id: uuidv7(),
          companyId: sessao.companyId,
          fornecedorId: dados.fornecedorId,
          descricao: dados.descricao,
          natureza: dados.natureza,
          categoria: dados.categoria,
          emissao: dataNaLoja(),
          parcelaNumero: i + 1,
          parcelaTotal: dados.parcelas,
          vencimento: vencimentoDaParcela(dados.vencimento, i),
          valorPrevisto: deCentavos(
            i === dados.parcelas - 1 ? base + sobra : base,
          ).toFixed(2),
          observacao: dados.observacao,
        })),
      )

      await marcarMudanca(tx, sessao.companyId)
      revalidarPagar()

      return {
        tentativa,
        sucesso: {
          descricao: dados.descricao,
          parcelas: dados.parcelas,
          total: deCentavos(total),
          primeiroVencimento: vencimentoDaParcela(dados.vencimento, 0),
        },
      }
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

/**
 * Paga uma conta: ela muda de estado e o dinheiro sai do caixa, na mesma
 * transação.
 *
 * Espelho exato de `receberTitulo`, e de propósito — as duas telas fazem a
 * mesma coisa em sentidos opostos. Divergir aqui seria manter duas regras para
 * o mesmo problema, e uma delas envelheceria.
 */
export async function pagarConta(anterior: EstadoQuitar, form: FormData): Promise<EstadoQuitar> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = Object.fromEntries(
    CAMPOS_QUITAR.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoQuitar, string>

  const analise = esquemaQuitar.safeParse(valores)
  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    const campos: Partial<Record<CampoQuitar, string>> = {}
    for (const campo of CAMPOS_QUITAR) {
      const msg = porCampo[campo]?.[0]
      if (msg) campos[campo] = msg
    }
    const geral = z.flattenError(analise.error).formErrors[0]
    return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
  }

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      // Sem `join`, pelo mesmo motivo da baixa de título: o Postgres recusa
      // `for update` sobre o lado anulável de um outer join.
      const [conta] = await tx
        .select({
          id: contasPagar.id,
          codigo: contasPagar.codigo,
          descricao: contasPagar.descricao,
          valorPrevisto: contasPagar.valorPrevisto,
          pagoEm: contasPagar.pagoEm,
        })
        .from(contasPagar)
        .where(eq(contasPagar.id, dados.contaPagarId))
        .limit(1)
        .for('update')

      if (!conta) return { erro: 'Conta não encontrada.', valores, tentativa }
      if (conta.pagoEm) {
        return {
          erro: 'Esta conta já foi paga. Recarregue a tela para ver o pagamento.',
          valores,
          tentativa,
        }
      }

      const [banco] = await tx
        .select({ id: contasBancarias.id, nome: contasBancarias.nome })
        .from(contasBancarias)
        .where(and(eq(contasBancarias.id, dados.contaId), eq(contasBancarias.ativo, true)))
        .limit(1)
      if (!banco) return { campos: { contaId: 'Conta não encontrada' }, valores, tentativa }

      const [forma] = await tx
        .select({ id: formasPagamento.id, nome: formasPagamento.nome })
        .from(formasPagamento)
        .where(and(eq(formasPagamento.id, dados.formaId), eq(formasPagamento.ativo, true)))
        .limit(1)
      if (!forma) return { campos: { formaId: 'Forma não encontrada' }, valores, tentativa }

      const pago = centavos(dados.valorPago)
      const previsto = centavos(Number(conta.valorPrevisto))

      await tx
        .update(contasPagar)
        .set({
          pagoEm: dados.pagoEm,
          valorPago: deCentavos(pago).toFixed(2),
          contaId: banco.id,
          formaId: forma.id,
        })
        .where(eq(contasPagar.id, conta.id))

      await tx.insert(caixaMovimentos).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        contaId: banco.id,
        // A data do caixa é a do pagamento, não a de hoje: conta paga ontem e
        // lançada hoje pertence ao caixa de ontem.
        data: dados.pagoEm,
        sentido: 'saida',
        valor: deCentavos(pago).toFixed(2),
        categoria: 'Pagamento',
        descricao: `Conta ${conta.codigo ?? ''} · ${conta.descricao}`.trim(),
        origem: 'pagar',
        origemId: conta.id,
        usuarioId: autorDoLancamento(sessao),
      })

      await marcarMudanca(tx, sessao.companyId)
      revalidarPagar()

      return {
        tentativa,
        sucesso: {
          descricao: conta.descricao,
          valorPago: deCentavos(pago),
          conta: banco.nome,
          diferenca: deCentavos(previsto - pago),
        },
      }
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

/** Desfaz o pagamento. Mesma regra da baixa de título: estorna, não apaga. */
export async function desfazerPagamento(contaPagarId: string): Promise<ResultadoDesfazer> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [conta] = await tx
        .select({
          id: contasPagar.id,
          codigo: contasPagar.codigo,
          pagoEm: contasPagar.pagoEm,
          valorPago: contasPagar.valorPago,
          contaId: contasPagar.contaId,
        })
        .from(contasPagar)
        .where(eq(contasPagar.id, contaPagarId))
        .limit(1)
        .for('update')

      if (!conta) return { ok: false, erro: 'Conta não encontrada.' }
      if (!conta.pagoEm) return { ok: false, erro: 'Esta conta não está paga.' }

      const valor = centavos(Number(conta.valorPago ?? 0))

      if (conta.contaId && valor > 0) {
        await tx.insert(caixaMovimentos).values({
          id: uuidv7(),
          companyId: sessao.companyId,
          contaId: conta.contaId,
          data: dataNaLoja(),
          sentido: 'entrada',
          valor: deCentavos(valor).toFixed(2),
          categoria: 'Estorno de pagamento',
          descricao: `Pagamento desfeito da conta ${conta.codigo ?? ''}`.trim(),
          origem: 'pagar',
          origemId: conta.id,
          usuarioId: autorDoLancamento(sessao),
        })
      }

      await tx
        .update(contasPagar)
        .set({ pagoEm: null, valorPago: null })
        .where(and(eq(contasPagar.id, conta.id), isNotNull(contasPagar.pagoEm)))

      await marcarMudanca(tx, sessao.companyId)
      revalidarPagar()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: descreverFalha(err) }
  }
}

/* -------------------------------------------------------- abertura de caixa
 *
 * O registro do que a operadora contou na gaveta ao abrir o turno. O PDV, que
 * abre em aba própria (ver `src/app/(pdv)`), exige essa abertura antes de
 * liberar a venda — é o portão que garante que todo turno começa com um
 * número contado, não presumido.
 */

function revalidarAbertura() {
  revalidatePath('/financeiro/caixa')
  revalidatePath('/financeiro/caixa/abertura')
}

export async function abrirCaixa(
  anterior: EstadoAberturaCaixa,
  form: FormData,
): Promise<EstadoAberturaCaixa> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = Object.fromEntries(
    CAMPOS_ABERTURA_CAIXA.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoAberturaCaixa, string>

  const analise = esquemaAberturaCaixa.safeParse(valores)
  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    const campos: Partial<Record<CampoAberturaCaixa, string>> = {}
    for (const campo of CAMPOS_ABERTURA_CAIXA) {
      const msg = porCampo[campo]?.[0]
      if (msg) campos[campo] = msg
    }
    const geral = z.flattenError(analise.error).formErrors[0]
    return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
  }

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      const [conta] = await tx
        .select({ id: contasBancarias.id, nome: contasBancarias.nome })
        .from(contasBancarias)
        .where(and(eq(contasBancarias.id, dados.contaId), eq(contasBancarias.ativo, true)))
        .limit(1)
      if (!conta) return { campos: { contaId: 'Conta não encontrada' }, valores, tentativa }

      await tx.insert(caixaAberturas).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        contaId: conta.id,
        valorAbertura: dados.valorAbertura.toFixed(2),
        fundoTroco: dados.fundoTroco.toFixed(2),
        observacao: dados.observacao,
        usuarioId: autorDoLancamento(sessao),
      })

      await marcarMudanca(tx, sessao.companyId)
      revalidarAbertura()

      return {
        tentativa,
        sucesso: { conta: conta.nome, valorAbertura: dados.valorAbertura, fundoTroco: dados.fundoTroco },
      }
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

/* ------------------------------- cadastro de contas e formas de pagamento
 *
 * Até aqui as duas tabelas só eram escritas pelo `scripts/criar-empresa.mjs`,
 * no dia em que a distribuidora nascia. Abrir uma conta, trocar de maquininha
 * ou renegociar a taxa do débito exigia um desenvolvedor — e cadastro travado
 * leva sempre ao mesmo lugar: bancos chamados `RETROATIVO CAIXA ECONOMICA` e
 * formas `PIX RETROATIVO`, inventados para contornar o que a tela não deixava
 * corrigir. Quem faz isso não está errado; está sem alternativa.
 *
 * **Ninguém apaga; desativa.** Conta e forma são apontadas por venda, título e
 * movimento de caixa, todas com FK `restrict`, de propósito. Apagar uma forma
 * usada em cem vendas reescreveria o histórico do mês — e o banco recusaria de
 * qualquer jeito, com um erro que não explica nada na tela. Desativar tira do
 * combo e preserva o que já aconteceu.
 */

function revalidarMeios() {
  revalidatePath('/financeiro/contas')
  revalidatePath('/financeiro/caixa')
  revalidatePath('/financeiro/receber')
  revalidatePath('/financeiro/pagar')
  // O PDV monta o seletor de forma de pagamento a partir daqui.
  revalidatePath('/vendas/pdv')
}

/**
 * Cria ou edita uma conta bancária.
 *
 * `id` vazio significa criação. É a mesma action nas duas telas porque a
 * diferença entre elas é uma linha — e duas actions quase idênticas é como se
 * chega a uma validação corrigida num lado e esquecida no outro.
 */
export async function salvarConta(anterior: EstadoConta, form: FormData): Promise<EstadoConta> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const id = String(form.get('id') ?? '').trim()
  const valores = Object.fromEntries(
    CAMPOS_CONTA.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoConta, string>

  const analise = esquemaConta.safeParse(valores)
  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    const campos: Partial<Record<CampoConta, string>> = {}
    for (const campo of CAMPOS_CONTA) {
      const msg = porCampo[campo]?.[0]
      if (msg) campos[campo] = msg
    }
    const geral = z.flattenError(analise.error).formErrors[0]
    return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
  }

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      const linha = {
        nome: dados.nome,
        tipo: dados.tipo,
        saldoInicial: dados.saldoInicial.toFixed(2),
        atualizadoEm: new Date(),
      }

      if (id) {
        // O `where` do id basta: a RLS já limita a linha ao tenant da sessão,
        // então um id de outra distribuidora não encontra nada.
        const alterada = await tx
          .update(contasBancarias)
          .set(linha)
          .where(eq(contasBancarias.id, id))
          .returning({ id: contasBancarias.id })
        if (alterada.length === 0) {
          return { erro: 'Conta não encontrada.', valores, tentativa }
        }
      } else {
        await tx
          .insert(contasBancarias)
          .values({ id: uuidv7(), companyId: sessao.companyId, ...linha })
      }

      await marcarMudanca(tx, sessao.companyId)
      revalidarMeios()
      return { tentativa, sucesso: { nome: dados.nome, novo: !id } }
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

/**
 * Cria ou edita uma forma de pagamento.
 *
 * A taxa é gravada aqui e **congelada em cada venda** no momento em que ela
 * acontece (ver `vendas.taxas` e `pagamentos.taxa`). Corrigir o percentual em
 * outubro não reescreve o que foi cobrado em agosto — se reescrevesse, o DRE de
 * um mês já fechado mudaria sozinho por causa de uma renegociação com a
 * operadora do cartão.
 */
export async function salvarForma(anterior: EstadoForma, form: FormData): Promise<EstadoForma> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const id = String(form.get('id') ?? '').trim()
  const valores = Object.fromEntries(
    CAMPOS_FORMA.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoForma, string>

  const analise = esquemaForma.safeParse(valores)
  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    const campos: Partial<Record<CampoForma, string>> = {}
    for (const campo of CAMPOS_FORMA) {
      const msg = porCampo[campo]?.[0]
      if (msg) campos[campo] = msg
    }
    const geral = z.flattenError(analise.error).formErrors[0]
    return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
  }

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      if (dados.contaId) {
        // Relida dentro do tenant: a RLS vira validação de autorização de graça.
        const [conta] = await tx
          .select({ id: contasBancarias.id, ativo: contasBancarias.ativo })
          .from(contasBancarias)
          .where(eq(contasBancarias.id, dados.contaId))
          .limit(1)
        if (!conta) return { campos: { contaId: 'Conta não encontrada' }, valores, tentativa }
        if (!conta.ativo) {
          return {
            campos: {
              contaId: 'Esta conta está desativada — reative-a antes de apontar para ela',
            },
            valores,
            tentativa,
          }
        }
      }

      const linha = {
        nome: dados.nome,
        tipo: dados.tipo,
        taxaPercentual: dados.taxaPercentual.toFixed(4),
        prazoDias: dados.prazoDias,
        contaId: dados.contaId,
        atualizadoEm: new Date(),
      }

      if (id) {
        const alterada = await tx
          .update(formasPagamento)
          .set(linha)
          .where(eq(formasPagamento.id, id))
          .returning({ id: formasPagamento.id })
        if (alterada.length === 0) {
          return { erro: 'Forma de pagamento não encontrada.', valores, tentativa }
        }
      } else {
        await tx
          .insert(formasPagamento)
          .values({ id: uuidv7(), companyId: sessao.companyId, ...linha })
      }

      await marcarMudanca(tx, sessao.companyId)
      revalidarMeios()
      return { tentativa, sucesso: { nome: dados.nome, novo: !id } }
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

/**
 * Ativa ou desativa uma conta bancária.
 *
 * **Desativar a última conta ativa é recusado.** Sem nenhuma conta ativa o PDV
 * não fecha venda em dinheiro e a baixa de título não tem para onde mandar o
 * valor. As duas telas quebrariam com um erro genérico, três cliques adiante e
 * sem nenhuma pista de que a causa foi esta tela aqui.
 */
export async function alternarConta(id: string): Promise<ResultadoDesfazer> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [conta] = await tx
        .select({ ativo: contasBancarias.ativo })
        .from(contasBancarias)
        .where(eq(contasBancarias.id, id))
        .limit(1)
      if (!conta) return { ok: false, erro: 'Conta não encontrada.' }

      if (conta.ativo) {
        const [restantes] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(contasBancarias)
          .where(eq(contasBancarias.ativo, true))
        if ((restantes?.n ?? 0) <= 1) {
          return {
            ok: false,
            erro: 'Esta é a única conta ativa. Cadastre outra antes de desativar — sem nenhuma conta ativa o PDV não fecha venda.',
          }
        }
      }

      await tx
        .update(contasBancarias)
        .set({ ativo: !conta.ativo, atualizadoEm: new Date() })
        .where(eq(contasBancarias.id, id))

      await marcarMudanca(tx, sessao.companyId)
      revalidarMeios()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: descreverFalha(err) }
  }
}

/** Ativa ou desativa uma forma de pagamento. Mesma regra da última ativa. */
export async function alternarForma(id: string): Promise<ResultadoDesfazer> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [forma] = await tx
        .select({ ativo: formasPagamento.ativo })
        .from(formasPagamento)
        .where(eq(formasPagamento.id, id))
        .limit(1)
      if (!forma) return { ok: false, erro: 'Forma de pagamento não encontrada.' }

      if (forma.ativo) {
        const [restantes] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(formasPagamento)
          .where(eq(formasPagamento.ativo, true))
        if ((restantes?.n ?? 0) <= 1) {
          return {
            ok: false,
            erro: 'Esta é a única forma de pagamento ativa. Cadastre outra antes de desativar — sem nenhuma o PDV não fecha venda.',
          }
        }
      }

      await tx
        .update(formasPagamento)
        .set({ ativo: !forma.ativo, atualizadoEm: new Date() })
        .where(eq(formasPagamento.id, id))

      await marcarMudanca(tx, sessao.companyId)
      revalidarMeios()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: descreverFalha(err) }
  }
}
