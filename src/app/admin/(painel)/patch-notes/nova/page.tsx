import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { criarPatchNoteRascunho } from '@/modules/patch-notes/acoes'
import { FormularioPatchNote } from '../formulario-patch-note'

export const metadata: Metadata = { title: 'Nova novidade' }

export default function NovoPatchNote() {
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
          <CardTitle>Nova novidade</CardTitle>
          <CardDescription>Nasce como rascunho — publicar é um passo à parte.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPatchNote acao={criarPatchNoteRascunho} rotuloBotao="Criar rascunho" />
        </CardContent>
      </Card>
    </div>
  )
}
