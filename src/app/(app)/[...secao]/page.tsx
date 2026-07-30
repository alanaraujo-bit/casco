import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Hammer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { acharItem } from '@/lib/navegacao'

type Props = { params: Promise<{ secao: string[] }> }

/**
 * Rota coringa das telas ainda não construídas.
 *
 * Existe para que a navegação inteira seja percorrível desde já — dá para
 * clicar em tudo, ver o shell, o tema e a hierarquia funcionando, e mostrar ao
 * cliente o mapa do sistema antes de qualquer tela estar pronta. Some sozinha:
 * cada rota real criada tem precedência sobre a dinâmica no Next.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { secao } = await params
  const item = acharItem('/' + secao.join('/'))
  return { title: item?.rotulo ?? 'Não encontrado' }
}

export default async function PaginaEmConstrucao({ params }: Props) {
  const { secao } = await params
  const item = acharItem('/' + secao.join('/'))

  // URL que não está na navegação é 404 de verdade, não "em construção".
  if (!item) notFound()

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="grid size-11 place-items-center rounded-full bg-acento-suave text-acento-texto">
          <item.Icone className="size-5" aria-hidden />
        </div>

        <div className="space-y-1">
          <p className="text-base font-medium text-texto">{item.rotulo}</p>
          <p className="mx-auto max-w-[46ch] text-sm text-texto-suave">
            Esta tela ainda não foi construída. A navegação já está de pé para que o
            sistema possa ser percorrido por inteiro enquanto as telas ficam prontas.
          </p>
        </div>

        <Badge variant="neutro">
          <Hammer className="size-3" aria-hidden />
          Em construção · {item.grupo}
        </Badge>
      </CardContent>
    </Card>
  )
}
