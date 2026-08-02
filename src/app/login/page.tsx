import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/theme-toggle'
import { PainelMarca } from '@/components/marca/painel-marca'
import { FormularioLogin } from './formulario-login'

export const metadata: Metadata = { title: 'Entrar' }

type Props = { searchParams: Promise<{ destino?: string }> }

/**
 * Entrada do sistema.
 *
 * Fora do grupo `(app)`, então não herda o shell — quem não entrou não vê
 * sidebar nem topbar. Dois painéis no desktop: a vitrine da marca (fixa,
 * escura, não segue tema) e o formulário (segue). No mobile a vitrine vira
 * uma faixa compacta no topo — a operadora abre isto às 7h todo dia, e o que
 * ela precisa é do cursor já no campo de e-mail, não de rolar por baixo de
 * uma ilustração.
 */
export default async function PaginaLogin({ searchParams }: Props) {
  // `searchParams` é assíncrono nesta versão do Next — acesso síncrono foi removido.
  const { destino = '' } = await searchParams

  return (
    <main className="flex min-h-dvh flex-col bg-fundo lg:flex-row">
      <PainelMarca />

      <div className="flex flex-1 flex-col px-5 py-3.5 lg:px-8 lg:py-7">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-start justify-center pt-4 lg:items-center lg:pt-0">
          <div className="w-full max-w-sm">
            <div className="mb-5">
              <h1 className="text-xl font-semibold tracking-tight text-texto">Entrar</h1>
              <p className="mt-1 text-sm text-texto-suave">Acesse sua conta para continuar.</p>
            </div>

            <FormularioLogin destino={destino} />

            <p className="mt-4 text-center text-2xs text-texto-fraco">
              Esqueceu a senha? Fale com o responsável pela distribuidora.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
