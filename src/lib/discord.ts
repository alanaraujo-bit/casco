import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

/**
 * Aviso de feedback para o Discord da Aionix, por webhook.
 *
 * **Nunca bloqueia nem derruba o relato.** O banco (`feedbacks`) é a fonte de
 * verdade — a pessoa que relatou já tem a confirmação antes desta função ser
 * chamada. Se o Discord estiver fora do ar, a URL não estiver configurada, ou
 * o webhook tiver sido apagado do lado de lá, o pior resultado possível é o
 * aviso não sair; o relato continua gravado e visível pelo banco. Por isso
 * todo erro aqui é engolido e só logado — quem chama não tem `try/catch` a
 * fazer.
 *
 * A URL vem de `plataforma_config` (migration 0014), não de variável de
 * ambiente: é o que permite trocar o webhook pelo painel da Aionix sem um
 * novo deploy, para o dia em que o canal do Discord mudar.
 */

const TIMEOUT_MS = 5_000

const COR_POR_PRIORIDADE: Record<string, number> = {
  critica: 0xdc2626, // vermelho
  alta: 0xea580c, // laranja
  media: 0xd97706, // âmbar
  baixa: 0x64748b, // cinza
}

const ROTULO_TIPO: Record<string, string> = {
  bug: '🐞 Bug',
  melhoria: '💡 Melhoria',
  sugestao: '💬 Sugestão',
}

const ROTULO_PRIORIDADE: Record<string, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export interface AvisoFeedback {
  tipo: 'bug' | 'melhoria' | 'sugestao'
  prioridade: 'baixa' | 'media' | 'alta' | 'critica' | null
  titulo: string
  descricao: string
  empresa: string
  autor: string
  papel: string
  rota: string | null
  codigoErro: string | null
}

/** `true` se o aviso saiu. Nunca lança — falha vira `false` e um log. */
export async function avisarFeedbackNoDiscord(dados: AvisoFeedback): Promise<boolean> {
  const [config] = await db.execute<{ discord_webhook_feedback: string | null }>(
    sql`select * from plataforma_config_ler()`,
  )
  const url = config?.discord_webhook_feedback
  if (!url) {
    console.error('[discord] webhook de feedback não configurado em /admin/config — aviso não enviado.')
    return false
  }

  const campos = [
    { name: 'Distribuidora', value: dados.empresa, inline: true },
    { name: 'Relatado por', value: `${dados.autor} (${dados.papel})`, inline: true },
  ]
  if (dados.prioridade) {
    campos.push({ name: 'Prioridade', value: ROTULO_PRIORIDADE[dados.prioridade], inline: true })
  }
  if (dados.rota) campos.push({ name: 'Tela', value: dados.rota, inline: true })
  if (dados.codigoErro) campos.push({ name: 'Código do erro', value: dados.codigoErro, inline: true })

  const embed = {
    title: `${ROTULO_TIPO[dados.tipo]} · ${dados.titulo}`,
    description: dados.descricao,
    color: dados.prioridade ? COR_POR_PRIORIDADE[dados.prioridade] : 0x2563eb,
    fields: campos,
    timestamp: new Date().toISOString(),
  }

  const controlador = new AbortController()
  const corte = setTimeout(() => controlador.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      signal: controlador.signal,
    })
    if (!resposta.ok) {
      console.error(`[discord] webhook recusou o aviso: ${resposta.status} ${await resposta.text()}`)
      return false
    }
    return true
  } catch (err) {
    console.error('[discord] falha ao enviar aviso de feedback', err)
    return false
  } finally {
    clearTimeout(corte)
  }
}
