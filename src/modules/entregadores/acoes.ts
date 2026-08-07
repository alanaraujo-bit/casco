'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import { entregadores } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha } from '@/lib/erros'
import { marcarMudanca } from '@/modules/sincronizacao/servidor'
import {
  CAMPOS_ENTREGADOR,
  esquemaEntregador,
  type CampoEntregador,
  type EstadoFormularioEntregador,
} from './esquema'

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_ENTREGADOR.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoEntregador, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoEntregador, string>,
  tentativa: number,
): EstadoFormularioEntregador {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoEntregador, string>> = {}
  for (const campo of CAMPOS_ENTREGADOR) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  return { campos, valores, tentativa }
}

export async function criarEntregador(
  anterior: EstadoFormularioEntregador,
  form: FormData,
): Promise<EstadoFormularioEntregador> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaEntregador.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const id = uuidv7()

  try {
    await comTenant(async (tx, sessao) => {
      await tx.insert(entregadores).values({
        id,
        companyId: sessao.companyId,
        ...dados,
      })
      await marcarMudanca(tx, sessao.companyId)
    })
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }

  revalidatePath('/cadastro/entregadores')
  redirect(`/cadastro/entregadores?novo=${id}`)
}

export async function atualizarEntregador(
  id: string,
  anterior: EstadoFormularioEntregador,
  form: FormData,
): Promise<EstadoFormularioEntregador> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaEntregador.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  try {
    const alteradas = await comTenant(async (tx, sessao) => {
      const linhas = await tx
        .update(entregadores)
        .set(dados)
        .where(eq(entregadores.id, id))
        .returning({ id: entregadores.id })
      if (linhas.length > 0) await marcarMudanca(tx, sessao.companyId)
      return linhas
    })

    if (alteradas.length === 0) {
      return { erro: 'Entregador não encontrado.', valores, tentativa }
    }
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }

  revalidatePath('/cadastro/entregadores')
  redirect('/cadastro/entregadores')
}

export async function alternarAtivoEntregador(id: string, ativo: boolean) {
  await comTenant(async (tx, sessao) => {
    await tx.update(entregadores).set({ ativo }).where(eq(entregadores.id, id))
    await marcarMudanca(tx, sessao.companyId)
  })
  revalidatePath('/cadastro/entregadores', 'layout')
}
