'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import {
  contasPagar,
  estoqueMovimentos,
  estoqueSaldos,
  fornecedores,
  produtos,
  type TipoEstoque,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha, type Falha } from '@/lib/erros'
import { autorDoLancamento } from '@/lib/sessao'
import { dataNaLoja, formatarDataHora } from '@/lib/formatos'
import { centavos, deCentavos } from '@/modules/vendas/esquema'
import {
  CAMPOS_MOVIMENTO,
  REGRA,
  aplicarSinal,
  esquemaMovimento,
  rotuloTipo,
  type CampoMovimento,
  type EstadoFormularioMovimento,
} from './esquema'

/**
 * As duas escritas do módulo: lançar e estornar.
 *
 * Não existe editar nem apagar, e não é omissão — o banco recusa `update` e
 * `delete` em `estoque_movimentos` por trigger. Movimento é lançamento
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
  const geral = z.flattenError(erro).formErrors[0]
  return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
}

function revalidarTudo() {
  revalidatePath('/estoque/saldo')
  revalidatePath('/estoque/entradas')
  revalidatePath('/cadastro/produtos')
  revalidatePath('/vendas/pdv')
  revalidatePath('/financeiro/pagar')
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
  const quantidade = aplicarSinal(dados.tipo, dados.quantidade, dados.sentido)

  try {
    return await comTenant(async (tx, sessao) => {
      /**
       * Produto e fornecedor relidos aqui, não confiados no que veio do
       * formulário. O `select` roda dentro do tenant, então um `produtoId` de
       * outra distribuidora simplesmente não é encontrado — e a RLS vira
       * validação de autorização de graça, sem uma checagem que dê para esquecer.
       */
      const [produto] = await tx
        .select({
          id: produtos.id,
          nome: produtos.nome,
          unidade: produtos.unidade,
          controlaEstoque: produtos.controlaEstoque,
        })
        .from(produtos)
        .where(eq(produtos.id, dados.produtoId))
        .limit(1)

      if (!produto) return { erro: 'Produto não encontrado.', valores, tentativa }
      if (!produto.controlaEstoque) {
        return {
          erro: `${produto.nome} não controla estoque. Marque a opção no cadastro do produto antes de movimentar.`,
          valores,
          tentativa,
        }
      }

      let nomeFornecedor: string | null = null
      if (dados.fornecedorId) {
        const [f] = await tx
          .select({ nome: fornecedores.nome })
          .from(fornecedores)
          .where(eq(fornecedores.id, dados.fornecedorId))
          .limit(1)
        if (!f) return { erro: 'Fornecedor não encontrado.', valores, tentativa }
        nomeFornecedor = f.nome
      }

      await tx.insert(estoqueMovimentos).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        produtoId: dados.produtoId,
        quantidade: String(quantidade),
        tipo: dados.tipo,
        // Zero aqui não vira zero no banco: o trigger `estoque_custo_padrao`
        // troca pelo custo médio vigente. Ver a 0011.
        custoUnitario: dados.custoUnitario.toFixed(2),
        fornecedorId: dados.fornecedorId,
        documento: dados.documento,
        origem: 'balcao',
        usuarioId: autorDoLancamento(sessao),
        // Sessão de suporte Aionix não tem linha em `users` — `adminId` é o
        // par que preserva o autor mesmo assim. Ver 0016.
        adminId: sessao.adminId ?? null,
        observacao: dados.observacao,
      })

      /**
       * O título nasce na mesma transação do movimento, e é o ponto do
       * "gerar Conta a Pagar": ou a mercadoria entra e a dívida existe, ou
       * nenhuma das duas. Gravar em duas transações é como se descobre, no
       * fechamento, um estoque que entrou sem ninguém a quem pagar.
       */
      let tituloGerado: { valor: number; vencimento: string } | null = null
      if (dados.gerarContaPagar && dados.vencimento) {
        const total = deCentavos(centavos(dados.custoUnitario) * dados.quantidade)
        await tx.insert(contasPagar).values({
          id: uuidv7(),
          companyId: sessao.companyId,
          fornecedorId: dados.fornecedorId,
          descricao: dados.documento
            ? `Compra ${produto.nome} — nota ${dados.documento}`
            : `Compra ${produto.nome}`,
          // Mercadoria para revenda é custo, não despesa: entra no CMV e é o
          // que faz o DRE fechar em vez de exibir NaN.
          //
          // `origem: 'estoque'` é o que impede o DRE de contar esta compra
          // duas vezes — uma aqui e outra quando a mercadoria sair pela venda,
          // ao custo médio. O CMV vem da saída; este título é só a dívida.
          natureza: 'custo',
          origem: 'estoque',
          categoria: 'Compra de mercadoria',
          emissao: dataNaLoja(),
          vencimento: dados.vencimento,
          valorPrevisto: total.toFixed(2),
          observacao: dados.observacao,
        })
        tituloGerado = { valor: total, vencimento: dados.vencimento }
      }

      // Lido depois do insert, já com os triggers aplicados: é o número que a
      // operadora confere antes de lançar o próximo.
      const [saldo] = await tx
        .select({ quantidade: estoqueSaldos.quantidade, custoMedio: estoqueSaldos.custoMedio })
        .from(estoqueSaldos)
        .where(eq(estoqueSaldos.produtoId, dados.produtoId))
        .limit(1)

      revalidarTudo()

      return {
        tentativa,
        sucesso: {
          tipo: dados.tipo,
          quantidade: dados.quantidade,
          produto: nomeFornecedor ? `${produto.nome} · ${nomeFornecedor}` : produto.nome,
          unidade: produto.unidade,
          saldo: Number(saldo?.quantidade ?? 0),
          custoMedio: Number(saldo?.custoMedio ?? 0),
          tituloGerado,
        },
      }
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}

export interface ResultadoEstorno {
  ok: boolean
  erro?: Falha | string
}

/**
 * Desfaz um movimento lançando o oposto, com o mesmo tipo.
 *
 * O mesmo tipo é o detalhe que importa: estornar uma `compra 800` como
 * `perda 800` faria o extrato afirmar que a mercadoria estragou. Ela não
 * estragou — nós erramos, e a diferença aparece no DRE como custo de perda que
 * nunca existiu.
 *
 * O trigger `estoque_valida_estorno` garante o espelhamento e devolve o custo
 * congelado do original, e é disso que o trigger de saldo depende para remover
 * do custo médio exatamente a camada que a entrada colocou.
 *
 * **O título em Contas a Pagar não é cancelado junto.** A dívida com o
 * fornecedor é um fato do mundo, e some do sistema só quando alguém decide que
 * sumiu — a tela avisa e manda para Contas a Pagar.
 */
export async function estornarMovimento(id: string): Promise<ResultadoEstorno> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [original] = await tx
        .select()
        .from(estoqueMovimentos)
        .where(eq(estoqueMovimentos.id, id))
        .limit(1)

      if (!original) return { ok: false, erro: 'Movimento não encontrado.' }
      if (original.estornoDe) return { ok: false, erro: 'Não se estorna um estorno.' }
      if (!REGRA[original.tipo as TipoEstoque]?.lancavelNaMao) {
        return {
          ok: false,
          erro: 'Baixa de venda se desfaz cancelando a venda, não estornando o estoque.',
        }
      }

      await tx.insert(estoqueMovimentos).values({
        id: uuidv7(),
        companyId: sessao.companyId,
        produtoId: original.produtoId,
        quantidade: String(-Number(original.quantidade)),
        tipo: original.tipo,
        // O trigger reescreve com o custo do original de qualquer forma; passar
        // o mesmo valor aqui evita que os dois discordem se o trigger mudar.
        custoUnitario: original.custoUnitario,
        fornecedorId: original.fornecedorId,
        documento: original.documento,
        origem: 'ajuste',
        origemId: original.id,
        usuarioId: autorDoLancamento(sessao),
        adminId: sessao.adminId ?? null,
        // Fuso explícito: esta frase fica gravada no banco e é lida meses
        // depois. A hora do servidor da Vercel (UTC) apontaria para um momento
        // em que a loja estava fechada.
        observacao: `Estorno de "${rotuloTipo(original.tipo)}" lançado em ${formatarDataHora(original.criadoEm)}.`,
        estornoDe: original.id,
      })

      revalidarTudo()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: descreverFalha(err) }
  }
}

export interface ResultadoExclusao {
  ok: boolean
  erro?: Falha | string
}

/**
 * Marca o lançamento como excluído — a linha não sai do banco.
 *
 * O trigger `estoque_mov_imutavel` (ver a 0015) só deixa passar essa mudança
 * pontual, e o trigger `estoque_mov_saldo_exclusao` refaz o saldo do produto
 * do zero a partir do que sobrou. A aba Movimentações continua mostrando a linha —
 * é o histórico da exclusão — mas sem o detalhe financeiro, que deixa de
 * valer no minuto em que isto roda.
 *
 * Mesmas duas travas do estorno, e pelo mesmo motivo: baixa de venda se desfaz
 * cancelando a venda, e um estorno não se exclui — ele é a explicação de outro
 * lançamento, e sumir com ele deixaria o original parecendo nunca corrigido.
 */
export async function excluirMovimento(id: string): Promise<ResultadoExclusao> {
  try {
    return await comTenant(async (tx, sessao) => {
      const [original] = await tx
        .select()
        .from(estoqueMovimentos)
        .where(eq(estoqueMovimentos.id, id))
        .limit(1)

      if (!original) return { ok: false, erro: 'Movimento não encontrado.' }
      if (original.excluidoEm) return { ok: false, erro: 'Este movimento já foi excluído.' }
      if (original.estornoDe) {
        return {
          ok: false,
          erro: 'Não se exclui um estorno — ele já é a correção de outro lançamento.',
        }
      }
      if (!REGRA[original.tipo as TipoEstoque]?.lancavelNaMao) {
        return {
          ok: false,
          erro: 'Baixa de venda se desfaz cancelando a venda, não excluindo o estoque.',
        }
      }

      await tx
        .update(estoqueMovimentos)
        .set({
          excluidoEm: new Date(),
          excluidoPor: autorDoLancamento(sessao),
          excluidoPorAdminId: sessao.adminId ?? null,
        })
        .where(eq(estoqueMovimentos.id, id))

      revalidarTudo()
      return { ok: true }
    })
  } catch (err) {
    return { ok: false, erro: descreverFalha(err) }
  }
}
