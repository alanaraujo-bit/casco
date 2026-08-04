import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Rocket, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EstadoVazio } from '@/components/ui/estados'
import { formatarDataHora } from '@/lib/formatos'
import { listarPatchNotesAdmin } from '@/modules/patch-notes/consultas'
import { mudarStatusPatchNote } from '@/modules/patch-notes/acoes'
import { ROTULO_CATEGORIA_PATCH_NOTE, ROTULO_STATUS_PATCH_NOTE } from '@/modules/patch-notes/esquema'

export const metadata: Metadata = { title: 'Patch Notes' }

const VARIANTE_STATUS = {
  rascunho: 'neutro',
  publicado: 'sucesso',
  arquivado: 'perigo',
} as const

/**
 * Fila de admin: tudo, rascunho incluído. Uma lista de cards, no mesmo molde
 * das outras telas de `/admin` (ver `empresas/page.tsx`) — o volume esperado
 * (dezenas de novidades) não justifica `TabelaDados`.
 */
export default async function PainelPatchNotes() {
  const notas = await listarPatchNotesAdmin()

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-texto">Patch Notes</h1>
          <Button asChild variant="primario" size="sm">
            <Link href="/admin/patch-notes/nova">
              <Plus aria-hidden />
              Nova novidade
            </Link>
          </Button>
        </div>
      </div>

      {notas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma novidade ainda"
          descricao="Crie a primeira para começar a Central de Atualizações."
        />
      ) : (
        <ul className="space-y-2">
          {notas.map((nota) => (
            <li key={nota.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={VARIANTE_STATUS[nota.status]}>
                      {ROTULO_STATUS_PATCH_NOTE[nota.status]}
                    </Badge>
                    <Badge variant="neutro">{ROTULO_CATEGORIA_PATCH_NOTE[nota.categoria]}</Badge>
                    <span className="truncate font-medium text-texto">{nota.titulo}</span>
                  </div>
                  <p className="text-xs text-texto-fraco">
                    Atualizado em {formatarDataHora(nota.atualizadoEm)}
                    {nota.publicadoEm && ` · publicado em ${formatarDataHora(nota.publicadoEm)}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button asChild variant="secundario" size="sm" className="w-full sm:w-auto">
                    <Link href={`/admin/patch-notes/${nota.id}`}>
                      <Pencil aria-hidden />
                      Editar
                    </Link>
                  </Button>

                  {nota.status === 'rascunho' && (
                    <form action={mudarStatusPatchNote}>
                      <input type="hidden" name="id" value={nota.id} />
                      <input type="hidden" name="statusAtual" value="rascunho" />
                      <input type="hidden" name="statusAlvo" value="publicado" />
                      <Button type="submit" variant="primario" size="sm" className="w-full sm:w-auto">
                        <Rocket aria-hidden />
                        Publicar
                      </Button>
                    </form>
                  )}

                  {nota.status === 'publicado' && (
                    <form action={mudarStatusPatchNote}>
                      <input type="hidden" name="id" value={nota.id} />
                      <input type="hidden" name="statusAtual" value="publicado" />
                      <input type="hidden" name="statusAlvo" value="arquivado" />
                      <Button type="submit" variant="secundario" size="sm" className="w-full sm:w-auto">
                        <Archive aria-hidden />
                        Arquivar
                      </Button>
                    </form>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
