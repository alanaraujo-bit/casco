import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EstadoVazio } from '@/components/ui/estados'
import { CorpoMarkdown } from '@/components/patch-notes/corpo-markdown'
import { formatarData } from '@/lib/formatos'
import { listarPatchNotesPublicados } from '@/modules/patch-notes/consultas'
import { ROTULO_CATEGORIA_PATCH_NOTE } from '@/modules/patch-notes/esquema'

export const metadata: Metadata = { title: 'Central de Atualizações' }

const VARIANTE_CATEGORIA = {
  novo: 'acento',
  melhoria: 'info',
  correcao: 'sucesso',
  desempenho: 'sucesso',
  seguranca: 'alerta',
  interface: 'neutro',
} as const

export default async function PaginaAtualizacoes() {
  const notas = await listarPatchNotesPublicados()

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Central de Atualizações"
        descricao="O que mudou no Casco"
      />

      {notas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma novidade publicada ainda"
          descricao="Assim que uma atualização for publicada, ela aparece aqui."
        />
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {notas.map((nota) => (
            <Card key={nota.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={VARIANTE_CATEGORIA[nota.categoria]}>
                      {ROTULO_CATEGORIA_PATCH_NOTE[nota.categoria]}
                    </Badge>
                    <span className="text-2xs text-texto-fraco">
                      {formatarData(nota.publicadoEm)}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-texto">{nota.titulo}</h2>
                  <p className="text-sm text-texto-suave">{nota.resumo}</p>
                </div>
                <Sparkles className="size-4 shrink-0 text-acento-texto" aria-hidden />
              </CardHeader>
              <CardContent>
                <CorpoMarkdown corpo={nota.corpo} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
