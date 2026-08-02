import * as React from 'react'
import { Lightbulb, ShieldAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Os três avisos que um artigo de ajuda precisa, e só esses três.
 *
 * Mesma paleta semântica do resto do produto (`--info`, `--alerta`, `--perigo`)
 * — quem já aprendeu o que uma faixa âmbar significa numa tela de vendas não
 * precisa reaprender dentro da Central de Ajuda.
 *
 * `Dica` é atalho ou contexto — nada quebra se for ignorada.
 * `Atencao` é um erro comum de verdade, já visto no balcão.
 * `Importante` é a regra do produto: ignorá-la tem custo (o caso clássico é
 * "baixa de vasilhame nunca é venda").
 */
function Callout({
  Icone,
  tom,
  titulo,
  children,
}: {
  Icone: typeof Lightbulb
  tom: 'info' | 'alerta' | 'perigo'
  titulo: string
  children: React.ReactNode
}) {
  const cores = {
    info: 'bg-info-bg text-info',
    alerta: 'bg-alerta-bg text-alerta',
    perigo: 'bg-perigo-bg text-perigo',
  } as const

  return (
    <div className={cn('flex items-start gap-3 rounded-lg px-4 py-3', cores[tom])}>
      <Icone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-0.5 text-sm">
        <p className="font-semibold">{titulo}</p>
        <div className="text-texto [&_a]:underline [&_a]:underline-offset-2">{children}</div>
      </div>
    </div>
  )
}

export function Dica({ titulo = 'Dica', children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <Callout Icone={Lightbulb} tom="info" titulo={titulo}>
      {children}
    </Callout>
  )
}

export function Atencao({
  titulo = 'Atenção',
  children,
}: {
  titulo?: string
  children: React.ReactNode
}) {
  return (
    <Callout Icone={TriangleAlert} tom="alerta" titulo={titulo}>
      {children}
    </Callout>
  )
}

export function Importante({
  titulo = 'Importante',
  children,
}: {
  titulo?: string
  children: React.ReactNode
}) {
  return (
    <Callout Icone={ShieldAlert} tom="perigo" titulo={titulo}>
      {children}
    </Callout>
  )
}
