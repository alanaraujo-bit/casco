import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArtigoLayout } from '@/components/ajuda/artigo-layout'
import { acharArtigo, GRUPOS_AJUDA } from '@/lib/ajuda'

type Props = { params: Promise<{ grupo: string; artigo: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { grupo, artigo } = await params
  const encontrado = acharArtigo(grupo, artigo)
  return { title: encontrado ? encontrado.titulo : 'Artigo não encontrado' }
}

export default async function PaginaArtigo({ params }: Props) {
  const { grupo, artigo } = await params
  const encontrado = acharArtigo(grupo, artigo)

  // Mesma regra do `NAVEGACAO`/`PROXIMAS`: só o que está escrito é alcançável.
  // Digitar a URL de um artigo que ainda não existe dá 404 de verdade.
  if (!encontrado) notFound()

  const rotuloGrupo = GRUPOS_AJUDA.find((g) => g.slug === encontrado.grupoSlug)?.rotulo ?? ''
  const { Componente } = encontrado

  return (
    <ArtigoLayout grupo={rotuloGrupo} titulo={encontrado.titulo} resumo={encontrado.resumo}>
      <Componente />
    </ArtigoLayout>
  )
}
