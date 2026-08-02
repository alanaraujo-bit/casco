import { CascoCarregando } from './casco-carregando'

/**
 * Tela cheia de carregamento entre navegações (`loading.tsx`). Mesmo emblema
 * do login e da sidebar, só que com o vasilhame enchendo em vez de estático —
 * mantém a marca reconhecível em vez de trocar por um spinner qualquer.
 */
export function TelaCarregando() {
  return (
    <div className="grid min-h-dvh place-items-center bg-fundo" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-16 place-items-center rounded-2xl bg-acento text-acento-contraste shadow-lg">
          <CascoCarregando id="casco-tela-carregando" className="size-9" />
        </div>
        <span className="text-sm text-texto-suave">Carregando…</span>
      </div>
    </div>
  )
}
