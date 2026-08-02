/**
 * A marca do Casco é o próprio vasilhame: o corpo do galão/botijão com um
 * entalhe do lado direito. Esse entalhe é a alça de carregar o vasilhame E,
 * ao mesmo tempo, a abertura da letra "C" — as duas leituras são verdadeiras
 * de propósito, não um acaso.
 *
 * `fillRule="evenodd"` com os dois caminhos concatenados abre o entalhe como
 * buraco no mesmo path, sem precisar de `<mask>` — o que evitaria colisão de
 * `id` se o glifo aparecer mais de uma vez na mesma página (sidebar + topbar
 * mobile, por exemplo).
 */
export const CASCO_CORPO_D =
  'M60 8C66 8 66 14 66 14L66 22C77 26 83 36 83 48L83 75C83 83 76 89 67 89L39 89C30 89 23 83 23 75L23 48C23 36 29 26 40 22L40 14C40 14 40 8 46 8Z'

export const CASCO_ENTALHE_D =
  'M79 46C87 49 87 67 79 70C74 71.5 71 68.5 71 64L71 52C71 47.5 74 44.5 79 46Z'

export const CASCO_GLIFO_D = `${CASCO_CORPO_D} ${CASCO_ENTALHE_D}`

export function GlifoCasco({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <path fillRule="evenodd" fill="currentColor" d={CASCO_GLIFO_D} />
    </svg>
  )
}
