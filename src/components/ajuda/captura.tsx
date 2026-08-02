import { cn } from '@/lib/utils'

/**
 * Screenshot estático com legenda — para apoiar um passo que não precisa de
 * vídeo (uma tela de resultado, um estado de erro). O `Video` é para o fluxo
 * inteiro; `Captura` é para "olha como fica essa parte".
 */
export function Captura({
  src,
  legenda,
  className,
}: {
  /** PNG em `public/ajuda/`, gerado pelo `scripts/capturar-ajuda.mjs`. */
  src: string
  legenda: string
  className?: string
}) {
  return (
    <figure
      className={cn('overflow-hidden rounded-lg border border-borda bg-superficie-afundada', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem de conteúdo capturada em tamanho variável, não um asset otimizável do build */}
      <img src={src} alt={legenda} className="w-full" loading="lazy" />
      <figcaption className="border-t border-borda px-3 py-2 text-xs text-texto-suave">
        {legenda}
      </figcaption>
    </figure>
  )
}
