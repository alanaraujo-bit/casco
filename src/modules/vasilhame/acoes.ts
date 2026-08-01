'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import {
  clientes,
  produtos,
  vasilhameMovimentos,
  vasilhameSaldos,
  type MotivoVasilhame,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'
import {
  CAMPOS_MOVIMENTO,
  REGRA,
  aplicarSinal,
  esquemaMovimento,
  type CampoMovimento,
  type EstadoFormularioMovimento,
} from './esquema'

/**
 * As duas escritas do módulo: lançar e estornar.
 *
 * Não existe editar nem apagar, e não é omissão — o banco recusa `update` e
 * `delete` em `vasilhame_movimentos` por trigger. Movimento é lançamento
 * contábil: corrigir é lançar o contrário, e as duas linhas ficam à vista no
 * extrato. É o que faz o saldo continuar explicável pelo histórico que o gerou.
 */

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_MOVIMENTO.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoMovimento, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoMovimento, string>,
  tentativa: number,
): EstadoFormularioMovimento {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoMovimento, string>> = {}
  for (const campo of CAMPOS_MOVIMENTO) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  // Erro de `.refine()` no objeto inteiro não cai em nenhum campo; sem este
  // resgate o formulário recusaria em silêncio e a operadora clicaria de novo.
  const geral = z.flattenError(erro).formErrors[0]
  return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
}

function revalidarTudo() {
  revalidatePath('/vasilhame/baixa')
  revalidatePath('/vasilhame/saldos')
  revalidatePath('/vasilhame/movimentos')
  revalidatePath('/cadastro/clientes')
}

/**
 * Traduz a recusa do banco para uma frase que serve a quem está no balcão.
 *
 * Os check constraints da 0005 não deveriam ser alcançáveis pela tela — o
 * `esquema.ts` já barra antes. Existem para o caso de alcançarem: script solto,
 * requisição forjada, ou um bug nosso. Quando isso acontecer, o que a operadora
 * não pode ver é `new row for relation "vasilhame_movimentos" violates check
 * constraint`.
 */
function mensagemDoBanco(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err)
  if (texto.includes('vasilhame_mov_exige_cliente')) return 'Este motivo exige um cliente.'
  if (texto.includes('vasilhame_mov_fabrica_sem_cliente'))
    return 'Movimento de fábrica é interno e não pode ter cliente.'
  if (texto.includes('vasilhame_mov_sinal_coerente'))
    return 'O sentido do movimento não combina com o motivo escolhido.'
  if (texto.includes('vasilhame_mov_estorno_unico'))
    return 'Este movimento já foi estornado.'
  if (texto.includes('estorna um estorno')) return 'Não se estorna um estorno.'
  return 'Não foi possível gravar o movimento. Tente de novo.'
}

export async function lancarMovimento(
  anterior: EstadoFormularioMovimento,
  form: FormData,
): Promise<EstadoFormularioMovimento> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaMovimento.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const quantidade = aplicarSinal(dados.motivo, dados.quantidade, dados.sentido)

  try {
    return await comTenant(async (tx, sessao) => {
      /**
       * Produto e cliente relidos aqui, não confiados no que veio do formulário.
       * O `select` roda dentro do tenant, então um `produtoId` de outra
       * distribuidora simplesmente não é encontrado — e a RLS vira validação de
       * autorização de graça, sem uma checagem que alguém possa esquecer.
       */
      const [produto] = await tx
        .select({ id: produtos.id, nome: produtos.nome, custo: produtos.custo })
        .from(produtos)
        .where(eq(produtos.id, dados.produtoId))
        .limit(1)

      if (!produto) {
        return { erro: 'Vasilhame não encontrado.', valores, tentativa }
      }

      let nomeCliente: string | null = null
      if (dados.clienteId) {
        const [pessoa] = await tx
          .select({ nome: clientes.nome })
          .from(clientes)
          .where(eq(clientes.id, dados.clienteId))
          .limit(1)
        if (!pessoa) {
          return { erro: 'Cliente não encontrado.', valores, tentativa }
        }
        nomeCliente = pessoa.nome
      }

      await tx.insert(vasilhameMovimentos).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        clienteId: dados.clienteId,
        produtoId: dados.produtoId,
        quantidade,
        motivo: dados.motivo,
        origem: 'balcao',
        // Congelado agora. O relatório de maio não pode mudar porque o galão
        // encareceu em agosto — e é o custo desta linha que o DRE vai somar.
        custoUnitario: produto.custo,
        usuarioId: sessao.usuarioId,
        observacao: dados.observacao,
      })

      // Lido depois do insert, já com o trigger aplicado: é o número que a
      // operadora repete para o cliente antes dele sair do balcão.
      let saldoCliente: number | null = null
      if (dados.clienteId) {
        const [saldo] = await tx
          .select({ quantidade: vasilhameSaldos.quantidade })
          .from(vasilhameSaldos)
          .where(
            and(
              eq(vasilhameSaldos.clienteId, dados.clienteId),
              eq(vasilhameSaldos.produtoId, dados.produtoId),
            ),
          )
          .limit(1)
        saldoCliente = saldo?.quantidade ?? 0
      }

      revalidarTudo()

      return {
        tentativa,
        sucesso: {
          motivo: dados.motivo,
          quantidade: dados.quantidade,
          produto: produto.nome,
          cliente: nomeCliente,
          saldoCliente,
        },
      }
    })
  } catch (err) {
    return { erro: mensagemDoBanco(err), valores, tentativa }
  }
}

export interface ResultadoEstorno {
  ok: boolean
  erro?: string
}

/**
 * Desfaz um movimento lançando o oposto, com o mesmo motivo.
 *
 * O mesmo motivo é o detalhe que importa: estornar `entregue 5` como
 * `devolvido 5` faria o extrato afirmar que o cliente trouxe o galão de volta.
 * Ele não trouxe — nós erramos. O trigger `vasilhame_valida_estorno` garante o
 * espelhamento, e a view de perdas ignora os dois lados, para que um
 * `quebrado` digitado errado não fique custando no DRE para sempre.
 */
export async function estornarMovimento(id: string): Promise<ResultadoEstorno> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [original] = await tx
        .select()
        .from(vasilhameMovimentos)
        .where(eq(vasilhameMovimentos.id, id))
        .limit(1)

      if (!original) return { ok: false, erro: 'Movimento não encontrado.' }
      if (original.estornoDe) return { ok: false, erro: 'Não se estorna um estorno.' }

      const rotulo = REGRA[original.motivo as MotivoVasilhame]?.rotulo ?? original.motivo

      await tx.insert(vasilhameMovimentos).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        clienteId: original.clienteId,
        produtoId: original.produtoId,
        quantidade: -original.quantidade,
        motivo: original.motivo,
        origem: 'ajuste',
        origemId: original.id,
        // O trigger reescreve com o custo do original de qualquer forma; passar
        // o mesmo valor aqui evita que os dois discordem se o trigger mudar.
        custoUnitario: original.custoUnitario,
        usuarioId: sessao.usuarioId,
        observacao: `Estorno de "${rotulo}" lançado em ${original.criadoEm.toLocaleString('pt-BR')}.`,
        estornoDe: original.id,
      })

      revalidarTudo()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: mensagemDoBanco(err) }
  }
}
