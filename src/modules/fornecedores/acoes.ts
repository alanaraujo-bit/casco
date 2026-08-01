'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import { fornecedores } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { acharFornecedorPorDocumento } from './consultas'
import {
  CAMPOS_FORNECEDOR,
  esquemaFornecedor,
  type CampoFornecedor,
  type EstadoFormularioFornecedor,
} from './esquema'

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_FORNECEDOR.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoFornecedor, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoFornecedor, string>,
  tentativa: number,
): EstadoFormularioFornecedor {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoFornecedor, string>> = {}
  for (const campo of CAMPOS_FORNECEDOR) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  return { campos, valores, tentativa }
}

async function documentoEmUso(
  documento: string | null,
  exceto: string | undefined,
  valores: Record<CampoFornecedor, string>,
  tentativa: number,
): Promise<EstadoFormularioFornecedor | null> {
  if (!documento) return null
  const dono = await acharFornecedorPorDocumento(documento, exceto)
  if (!dono) return null
  return {
    campos: {
      documento: `Já existe em ${dono.codigo ? `${String(dono.codigo).padStart(4, '0')} - ` : ''}${dono.nome}`,
    },
    valores,
    tentativa,
  }
}

function ehDocumentoDuplicado(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'constraint_name' in err &&
    err.constraint_name === 'fornecedores_documento_unico'
  )
}

export async function criarFornecedor(
  anterior: EstadoFormularioFornecedor,
  form: FormData,
): Promise<EstadoFormularioFornecedor> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaFornecedor.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const conflito = await documentoEmUso(dados.documento, undefined, valores, tentativa)
  if (conflito) return conflito

  const id = uuidv7()

  try {
    await comTenant((tx, sessao) =>
      tx.insert(fornecedores).values({
        id,
        companyId: sessao.companyId,
        ...dados,
      }),
    )
  } catch (err) {
    if (ehDocumentoDuplicado(err)) {
      return {
        campos: { documento: 'Este CPF/CNPJ já está em outro cadastro.' },
        valores,
        tentativa,
      }
    }
    throw err
  }

  revalidatePath('/cadastro/fornecedores')
  redirect(`/cadastro/fornecedores?novo=${id}`)
}

export async function atualizarFornecedor(
  id: string,
  anterior: EstadoFormularioFornecedor,
  form: FormData,
): Promise<EstadoFormularioFornecedor> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaFornecedor.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const conflito = await documentoEmUso(dados.documento, id, valores, tentativa)
  if (conflito) return conflito

  try {
    const alteradas = await comTenant((tx) =>
      tx
        .update(fornecedores)
        .set(dados)
        .where(eq(fornecedores.id, id))
        .returning({ id: fornecedores.id }),
    )

    if (alteradas.length === 0) {
      return { erro: 'Fornecedor não encontrado.', valores, tentativa }
    }
  } catch (err) {
    if (ehDocumentoDuplicado(err)) {
      return {
        campos: { documento: 'Este CPF/CNPJ já está em outro cadastro.' },
        valores,
        tentativa,
      }
    }
    throw err
  }

  revalidatePath('/cadastro/fornecedores')
  redirect('/cadastro/fornecedores')
}

export async function alternarAtivoFornecedor(id: string, ativo: boolean) {
  await comTenant((tx) =>
    tx.update(fornecedores).set({ ativo }).where(eq(fornecedores.id, id)),
  )
  revalidatePath('/cadastro/fornecedores', 'layout')
}
