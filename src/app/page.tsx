import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div
            aria-hidden
            className="grid size-9 place-items-center rounded-lg bg-acento text-acento-contraste text-lg font-bold"
          >
            C
          </div>
          <span className="text-2xl font-semibold tracking-tight text-texto">Casco</span>
        </div>

        <p className="text-sm text-texto-suave">
          Gestão para distribuidoras com vasilhame retornável — água e gás.
        </p>

        <Button asChild variant="primario" size="lg">
          <Link href="/design">Ver o design system</Link>
        </Button>

        <p className="text-2xs text-texto-fraco">Em construção · Etapa 0.4 do roadmap</p>
      </div>
    </main>
  )
}
