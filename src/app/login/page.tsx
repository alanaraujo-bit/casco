import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/theme-toggle'
import { FormularioLogin } from './formulario-login'

export const metadata: Metadata = { title: 'Entrar' }

type Props = { searchParams: Promise<{ destino?: string }> }

/**
 * Entrada do sistema.
 *
 * Fora do grupo `(app)`, então não herda o shell — quem não entrou não vê
 * sidebar nem topbar. Sem cartão flutuante nem ilustração: a operadora abre
 * isto às 7h todo dia, e o que ela precisa é do cursor já no campo de e-mail.
 */
export default async function PaginaLogin({ searchParams }: Props) {
  // `searchParams` é assíncrono nesta versão do Next — acesso síncrono foi removido.
  const { destino = '' } = await searchParams

  return (
    <main className="grid min-h-dvh place-items-center bg-fundo px-4 py-10">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-7">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <div
              aria-hidden
              className="grid size-9 place-items-center rounded-lg bg-acento text-lg font-bold text-acento-contraste"
            >
              C
            </div>
            <span className="text-2xl font-semibold tracking-tight text-texto">Casco</span>
          </div>
          <p className="text-sm text-texto-suave">Entre para acessar o sistema.</p>
        </div>

        <FormularioLogin destino={destino} />

        <p className="text-center text-2xs text-texto-fraco">
          Esqueceu a senha? Fale com o responsável pela distribuidora.
        </p>
      </div>
    </main>
  )
}
