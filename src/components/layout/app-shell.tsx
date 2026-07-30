'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ConteudoSidebar, Sidebar } from '@/components/layout/sidebar'
import { acharItem } from '@/lib/navegacao'
import { cn } from '@/lib/utils'

function Topbar({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const caminho = usePathname()
  const item = acharItem(caminho)

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex items-center gap-3 border-b border-borda bg-superficie px-3 md:px-5',
        // A altura acompanha a safe-area do topo para o conteúdo não ficar sob
        // o notch quando o app roda em tela cheia.
        'h-14 pt-[env(safe-area-inset-top)]',
      )}
    >
      <button
        type="button"
        onClick={aoAbrirMenu}
        aria-label="Abrir menu"
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-md md:hidden',
          'text-texto-suave hover:bg-superficie-hover hover:text-texto',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
        )}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        {/* h1 por página, no topbar: o leitor de tela anuncia onde está a cada
            navegação, sem depender de cada tela lembrar de declarar o seu. */}
        <h1 className="truncate text-base font-semibold tracking-tight text-texto">
          {item?.rotulo ?? 'Casco'}
        </h1>
        {item && (
          <p className="truncate text-2xs text-texto-fraco md:hidden">{item.grupo}</p>
        )}
      </div>

      <ThemeToggle />
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = React.useState(false)
  const caminho = usePathname()

  // Fecha o drawer ao trocar de rota. Sem isso o menu fica aberto por cima da
  // tela que o usuário acabou de escolher.
  React.useEffect(() => {
    setMenuAberto(false)
  }, [caminho])

  return (
    <div className="flex min-h-dvh bg-fundo">
      <Sidebar />

      <Dialog.Root open={menuAberto} onOpenChange={setMenuAberto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 md:hidden" />
          <Dialog.Content
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-borda bg-superficie md:hidden',
              'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
              'focus:outline-none',
            )}
          >
            {/* Obrigatório pelo Radix e certo pelo leitor de tela: o drawer
                precisa se anunciar ao receber foco. */}
            <Dialog.Title className="sr-only">Navegação principal</Dialog.Title>
            <Dialog.Description className="sr-only">
              Escolha uma tela do sistema.
            </Dialog.Description>

            <Dialog.Close
              aria-label="Fechar menu"
              className={cn(
                'absolute right-2 top-2 grid size-11 place-items-center rounded-md',
                'text-texto-suave hover:bg-superficie-hover hover:text-texto',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
              )}
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>

            <ConteudoSidebar aoNavegar={() => setMenuAberto(false)} />
          </Dialog.Content>
        </Dialog.Portal>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar aoAbrirMenu={() => setMenuAberto(true)} />
          <main className="min-w-0 flex-1 p-3 md:p-5">{children}</main>
        </div>
      </Dialog.Root>
    </div>
  )
}
