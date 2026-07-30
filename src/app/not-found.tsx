import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-2xs font-medium uppercase tracking-wide text-texto-fraco">
          Erro 404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Esta tela não existe
        </h1>
        <p className="text-sm text-texto-suave">
          O endereço pode estar errado, ou a tela pode ter mudado de lugar.
        </p>
        <Button asChild variant="primario">
          <Link href="/painel">Ir para o Painel Gerencial</Link>
        </Button>
      </div>
    </main>
  )
}
