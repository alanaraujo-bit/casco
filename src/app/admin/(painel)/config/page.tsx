import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { buscarConfig } from '@/modules/admin/consultas'
import { FormularioConfig } from './formulario-config'

export const metadata: Metadata = { title: 'Configuração' }

/**
 * Configuração da plataforma. Hoje só o webhook do Discord — o painel cresce
 * conforme surgir mais alguma coisa que precise trocar sem um novo deploy.
 */
export default async function PainelConfig() {
  const config = await buscarConfig()

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-texto-suave hover:text-texto"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Distribuidoras
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-texto">Configuração</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>
            Bug, melhoria e sugestão relatados de dentro do sistema caem aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioConfig inicial={config.discordWebhookFeedback} />
        </CardContent>
      </Card>
    </div>
  )
}
