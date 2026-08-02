import { CASCO_GLIFO_D } from './glifo-casco'

/**
 * Versão animada do glifo, para carregamento.
 *
 * A ideia não é um spinner genérico — é o vasilhame enchendo, que é literalmente
 * o que o negócio faz. Um retângulo se move de baixo pra cima dentro de um
 * `clipPath` recortado com a mesma silhueta do glifo (entalhe incluso), então
 * só o "líquido" que está dentro do contorno aparece.
 *
 * O `id` é parametrizável porque `clipPath` precisa de referência única: duas
 * instâncias na mesma página (empresa raro, mas possível numa transição de
 * rota) com o mesmo id fariam a segunda referenciar o clip da primeira.
 *
 * `duracaoMs` existe pro painel de marca do login: o mesmo desenho, só que
 * mais lento e mais discreto — ali não está "carregando" nada, é decoração
 * viva, então o ciclo de 2,4s do carregamento de verdade ficaria ansioso.
 */
export function CascoCarregando({
  className,
  id = 'casco-carregando',
  duracaoMs = 2400,
}: {
  className?: string
  id?: string
  duracaoMs?: number
}) {
  const clipId = `${id}-clip`

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path fillRule="evenodd" d={CASCO_GLIFO_D} />
        </clipPath>
      </defs>
      <path fillRule="evenodd" d={CASCO_GLIFO_D} fill="currentColor" opacity={0.18} />
      <g clipPath={`url(#${clipId})`}>
        <rect
          className="casco-carregando__nivel"
          style={{ animationDuration: `${duracaoMs}ms` }}
          x="0"
          y="0"
          width="100"
          height="100"
          fill="currentColor"
        />
      </g>
    </svg>
  )
}
