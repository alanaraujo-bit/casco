import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buscarPatchNoteAdmin } from '@/modules/patch-notes/consultas'
import { atualizarPatchNote } from '@/modules/patch-notes/acoes'
import { ROTULO_STATUS_PATCH_NOTE } from '@/modules/patch-notes/esquema'
import { FormularioPatchNote } from '../formulario-patch-note'

export const metadata: Metadata = { title: 'Editar novidade' }

type Props = { params: Promise<{ id: string }> }

const VARIANTE_STATUS = {
  rascunho: 'neutro',
  publicado: 'sucesso',
  arquivado: 'perigo',
} as const

export default async function EditarPatchNote({ params }: Props) {
  const { id } = await params
  const nota = await buscarPatchNoteAdmin(id)
  if (!nota) notFound()

  const acao = atualizarPatchNote.bind(null, id)

  return (
    <div className="space-y-5">
      <Link
        href="/admin/patch-notes"
        className="inline-flex items-center gap-1 text-xs text-texto-suave hover:text-texto"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Patch Notes
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Editar novidade</CardTitle>
            <Badge variant={VARIANTE_STATUS[nota.status]}>{ROTULO_STATUS_PATCH_NOTE[nota.status]}</Badge>
          </div>
          <CardDescription>
            {nota.status === 'publicado'
              ? 'Já está no ar — editar aqui atualiza o que o cliente vê na hora.'
              : 'Ainda não publicado. Volte para a lista para publicar.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPatchNote
            acao={acao}
            inicial={{
              titulo: nota.titulo,
              resumo: nota.resumo,
              corpo: nota.corpo,
              categoria: nota.categoria,
              commitsOrigem: nota.commitsOrigem,
            }}
            rotuloBotao="Salvar"
          />
        </CardContent>
      </Card>
    </div>
  )
}
