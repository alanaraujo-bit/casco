'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import { estoqueMovimentos, produtos } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha } from '@/lib/erros'
import { autorDoLancamento } from '@/lib/sessao'
import {
  CAMPOS_PRODUTO,
  esquemaProduto,
  type CampoProduto,
  type EstadoFormularioProduto,
} from './esquema'

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_PRODUTO.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoProduto, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoProduto, string>,
  tentativa: number,
): EstadoFormularioProduto {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoProduto, string>> = {}
  for (const campo of CAMPOS_PRODUTO) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  return { campos, valores, tentativa }
}

export async function criarProduto(
  anterior: EstadoFormularioProduto,
  form: FormData,
): Promise<EstadoFormularioProduto> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaProduto.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const id = uuidv7()

  try {
    await comTenant(async (tx, sessao) => {
      await tx.insert(produtos).values({
        id,
        companyId: sessao.companyId,
        nome: dados.nome,
        sku: dados.sku,
        categoria: dados.categoria,
        unidade: dados.unidade,
        precoPadrao: String(dados.precoPadrao),
        custo: String(dados.custo),
        retornavel: dados.retornavel,
        vasilhameId: dados.vasilhameId,
        controlaEstoque: dados.controlaEstoque,
        estoqueMinimo: String(dados.estoqueMinimo),
        estoqueMaximo: String(dados.estoqueMaximo),
        ncm: dados.ncm,
      })

      /**
       * O vasilhame que já está na prateleira quando o cadastro nasce.
       *
       * Vira um `ajuste` — o mesmo tipo que "Ajuste de inventário" lança em
       * `/estoque/entradas/nova` — e não um `producao` ou `compra`: não foi
       * fabricado aqui nem chegou de fornecedor agora, só é o que já existia e a
       * operadora está contando pela primeira vez. Mesma transação do produto:
       * ou os dois nascem juntos, ou nenhum nasce, senão um produto sem esta
       * linha pareceria "controla estoque" mentindo um saldo de zero que nunca
       * foi zero de verdade.
       */
      if (dados.controlaEstoque && dados.estoqueInicial > 0) {
        await tx.insert(estoqueMovimentos).values({
          id: uuidv7(),
          companyId: sessao.companyId,
          produtoId: id,
          quantidade: String(dados.estoqueInicial),
          tipo: 'ajuste',
          custoUnitario: String(dados.custo),
          origem: 'balcao',
          usuarioId: autorDoLancamento(sessao),
          adminId: sessao.adminId ?? null,
          observacao: 'Estoque inicial, lançado no cadastro do produto',
        })
      }
    })
  } catch (err) {
    // Sem isto, SKU repetido ou NCM inválido — as duas regras que só o banco
    // conhece — estourava para a tela de erro genérica do Next, e o cadastro
    // inteiro que a operadora acabou de preencher desaparecia com ele.
    return { erro: descreverFalha(err), valores, tentativa }
  }

  revalidatePath('/cadastro/produtos')
  revalidatePath('/estoque/saldo')
  redirect(`/cadastro/produtos?novo=${id}`)
}

export async function atualizarProduto(
  id: string,
  anterior: EstadoFormularioProduto,
  form: FormData,
): Promise<EstadoFormularioProduto> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaProduto.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  let alteradas: { id: string }[]
  try {
    alteradas = await comTenant((tx) =>
      tx
        .update(produtos)
        .set({
          nome: dados.nome,
          sku: dados.sku,
          categoria: dados.categoria,
          unidade: dados.unidade,
          precoPadrao: String(dados.precoPadrao),
          custo: String(dados.custo),
          retornavel: dados.retornavel,
          vasilhameId: dados.vasilhameId,
          controlaEstoque: dados.controlaEstoque,
          estoqueMinimo: String(dados.estoqueMinimo),
          estoqueMaximo: String(dados.estoqueMaximo),
          ncm: dados.ncm,
        })
        .where(eq(produtos.id, id))
        .returning({ id: produtos.id }),
    )
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }

  if (alteradas.length === 0) {
    return { erro: 'Produto não encontrado.', valores, tentativa }
  }

  revalidatePath('/cadastro/produtos')
  redirect('/cadastro/produtos')
}

export async function alternarAtivoProduto(id: string, ativo: boolean) {
  await comTenant((tx) =>
    tx.update(produtos).set({ ativo }).where(eq(produtos.id, id)),
  )
  revalidatePath('/cadastro/produtos', 'layout')
}
