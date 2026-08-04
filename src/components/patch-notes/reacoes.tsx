import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { alternarReacaoPatchNote } from '@/modules/patch-notes/acoes'
import type { ContagemReacaoPatchNote } from '@/modules/patch-notes/consultas'

/**
 * Curtir/não curtir uma novidade. Servidor puro — o clique é um `<form>`
 * comum, sem JavaScript no caminho (Nível 1; otimismo de UI fica para o
 * Nível 3). `alternarReacaoPatchNote` decide sozinho se é reagir ou remover.
 */
export function Reacoes({
  patchNoteId,
  contagem,
}: {
  patchNoteId: string
  contagem: ContagemReacaoPatchNote
}) {
  return (
    <div className="flex items-center gap-2">
      <form action={alternarReacaoPatchNote}>
        <input type="hidden" name="patchNoteId" value={patchNoteId} />
        <input type="hidden" name="tipo" value="like" />
        <button
          type="submit"
          aria-pressed={contagem.minha === 'like'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
            contagem.minha === 'like'
              ? 'border-transparent bg-sucesso-bg text-sucesso'
              : 'border-borda text-texto-suave hover:bg-superficie-hover hover:text-texto',
          )}
        >
          <ThumbsUp className="size-3.5" aria-hidden />
          {contagem.likes > 0 && contagem.likes}
        </button>
      </form>

      <form action={alternarReacaoPatchNote}>
        <input type="hidden" name="patchNoteId" value={patchNoteId} />
        <input type="hidden" name="tipo" value="dislike" />
        <button
          type="submit"
          aria-pressed={contagem.minha === 'dislike'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
            contagem.minha === 'dislike'
              ? 'border-transparent bg-perigo-bg text-perigo'
              : 'border-borda text-texto-suave hover:bg-superficie-hover hover:text-texto',
          )}
        >
          <ThumbsDown className="size-3.5" aria-hidden />
          {contagem.dislikes > 0 && contagem.dislikes}
        </button>
      </form>
    </div>
  )
}
