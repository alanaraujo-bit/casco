import { NextResponse } from 'next/server'
import { exigirSessao } from '@/lib/dal'
import { lerUltimaMudanca } from '@/modules/sincronizacao/servidor'

/**
 * O que `SincronizarAoVivo` pergunta a cada poucos segundos: "algo mudou
 * nesta empresa desde a última vez que eu perguntei?"
 *
 * Sem parâmetro de empresa na URL — a sessão (cookie) já diz qual é, e é isso
 * que impede uma aba pedir o marcador de uma empresa que não é a sua.
 */
export async function GET() {
  const sessao = await exigirSessao()
  const atualizadoEm = await lerUltimaMudanca(sessao.companyId)
  return NextResponse.json({ atualizadoEm: atualizadoEm?.toISOString() ?? null })
}
