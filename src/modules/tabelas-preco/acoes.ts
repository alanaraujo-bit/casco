'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import { tabelasPreco, precos } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import {
  CAMPOS_TABELA,
  esquemaTabela,
  type CampoTabela,
  type EstadoFormularioTabela,
} from './esquema'

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_TABELA.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoTabela, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoTabela, string>,
  tentativa: number,
): EstadoFormularioTabela {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoTabela, string>> = {}
  for (const campo of CAMPOS_TABELA) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  return { campos, valores, tentativa }
}

export async function criarTabela(
  anterior: EstadoFormularioTabela,
  form: FormData,
): Promise<EstadoFormularioTabela> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaTabela.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const id = uuidv7()

  await comTenant(async (tx, sessao) => {
    if (dados.padrao) {
      await tx
        .update(tabelasPreco)
        .set({ padrao: false })
        .where(eq(tabelasPreco.padrao, true))
    }

    await tx.insert(tabelasPreco).values({
      id,
      companyId: sessao.companyId,
      nome: dados.nome,
      padrao: dados.padrao,
    })
  })

  revalidatePath('/cadastro/tabelas-preco')
  redirect(`/cadastro/tabelas-preco/${id}`)
}

export async function atualizarTabela(
  id: string,
  anterior: EstadoFormularioTabela,
  form: FormData,
): Promise<EstadoFormularioTabela> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaTabela.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  const alteradas = await comTenant(async (tx) => {
    if (dados.padrao) {
      await tx
        .update(tabelasPreco)
        .set({ padrao: false })
        .where(eq(tabelasPreco.padrao, true))
    }

    return tx
      .update(tabelasPreco)
      .set({ nome: dados.nome, padrao: dados.padrao })
      .where(eq(tabelasPreco.id, id))
      .returning({ id: tabelasPreco.id })
  })

  if (alteradas.length === 0) {
    return { erro: 'Tabela não encontrada.', valores, tentativa }
  }

  revalidatePath('/cadastro/tabelas-preco')
  redirect('/cadastro/tabelas-preco')
}

export async function alternarAtivoTabela(id: string, ativo: boolean) {
  await comTenant((tx) =>
    tx.update(tabelasPreco).set({ ativo }).where(eq(tabelasPreco.id, id)),
  )
  revalidatePath('/cadastro/tabelas-preco', 'layout')
}

export async function salvarPrecos(tabelaId: string, form: FormData) {
  const entradas: { produtoId: string; preco: number }[] = []

  for (const [chave, valor] of form.entries()) {
    if (!chave.startsWith('preco-')) continue
    const produtoId = chave.slice(6)
    const texto = String(valor).trim()
    if (!texto) continue
    const num = Number(texto.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(num) || num < 0) continue
    entradas.push({ produtoId, preco: num })
  }

  await comTenant(async (tx, sessao) => {
    await tx.delete(precos).where(eq(precos.tabelaId, tabelaId))

    if (entradas.length > 0) {
      await tx.insert(precos).values(
        entradas.map((e) => ({
          companyId: sessao.companyId,
          tabelaId,
          produtoId: e.produtoId,
          preco: String(e.preco),
        })),
      )
    }
  })

  revalidatePath('/cadastro/tabelas-preco', 'layout')
}
