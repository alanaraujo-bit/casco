'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { feedbacks } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha } from '@/lib/erros'
import { autorDoLancamento } from '@/lib/sessao'
import { avisarFeedbackNoDiscord } from '@/lib/discord'
import { CAMPOS_FEEDBACK, esquemaFeedback, type CampoFeedback, type EstadoFormularioFeedback } from './esquema'

const ROTULO_PAPEL: Record<string, string> = {
  dono: 'Dono',
  operador: 'Operador',
  entregador: 'Entregador',
}

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_FEEDBACK.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoFeedback, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoFeedback, string>,
  tentativa: number,
): EstadoFormularioFeedback {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoFeedback, string>> = {}
  for (const campo of CAMPOS_FEEDBACK) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  const geral = z.flattenError(erro).formErrors[0]
  return { campos, valores, tentativa, erro: Object.keys(campos).length ? undefined : geral }
}

/**
 * Grava o relato e avisa a Aionix.
 *
 * **O banco é o que garante o relato; o Discord é só o alerta.** A pessoa que
 * relatou recebe sucesso assim que a linha existe em `feedbacks` — o aviso é
 * tentado em seguida, e se ele falhar (Discord fora do ar, webhook mudou de
 * URL) ninguém que preencheu o formulário percebe. `avisado` fica `false` e o
 * relato continua achável direto no banco.
 */
export async function enviarFeedback(
  anterior: EstadoFormularioFeedback,
  form: FormData,
): Promise<EstadoFormularioFeedback> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaFeedback.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data

  try {
    const { id, aviso } = await comTenant(async (tx, sessao) => {
      const id = uuidv7()
      await tx.insert(feedbacks).values({
        id,
        companyId: sessao.companyId,
        usuarioId: autorDoLancamento(sessao),
        tipo: dados.tipo,
        prioridade: dados.prioridade,
        titulo: dados.titulo,
        descricao: dados.descricao,
        rota: dados.rota,
        codigoErro: dados.codigoErro,
      })

      return {
        id,
        aviso: {
          tipo: dados.tipo,
          prioridade: dados.prioridade,
          titulo: dados.titulo,
          descricao: dados.descricao,
          empresa: sessao.empresa,
          autor: sessao.nome,
          papel: sessao.adminId ? 'Suporte Aionix' : (ROTULO_PAPEL[sessao.papel] ?? sessao.papel),
          rota: dados.rota,
          codigoErro: dados.codigoErro,
        },
      }
    })

    const avisado = await avisarFeedbackNoDiscord(aviso)
    if (avisado) {
      await comTenant((tx) => tx.update(feedbacks).set({ avisado: true }).where(eq(feedbacks.id, id)))
    }

    return { tentativa, sucesso: true }
  } catch (err) {
    return { erro: descreverFalha(err), valores, tentativa }
  }
}
