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
        // A altura SOMA a safe-area em vez de reservá-la por dentro. Com
        // `h-14` + `padding-top`, o inset comeria o espaço do conteúdo: num
        // iPhone com notch em modo standalone o inset chega a 47px e sobrariam
        // 9px para o título e o seletor de tema.
        'h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]',
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
        {/* h1 por página, resolvido pela navegação: o leitor de tela anuncia
            onde está a cada rota, sem depender de cada tela lembrar de
            declarar o seu. */}
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

  // Fecha ao cruzar o breakpoint. O drawer tem `md:hidden`, mas o estado não
  // sabe disso: girar um tablet para paisagem com o menu aberto deixaria o
  // focus trap e o scroll lock do Radix presos num elemento `display:none` —
  // página que não rola e foco em lugar invisível.
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const fechar = () => {
      if (mq.matches) setMenuAberto(false)
    }
    fechar()
    mq.addEventListener('change', fechar)
    return () => mq.removeEventListener('change', fechar)
  }, [])

  return (
    <div className="flex min-h-dvh bg-fundo">
      <Sidebar />

      <Dialog.Root open={menuAberto} onOpenChange={setMenuAberto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-sobreposicao md:hidden" />
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
          {/* Primeiro elemento focável da página, e o mais importante desta
              tela: a sidebar vem antes do conteúdo no DOM, então sem ele são
              26 tabulações até o primeiro campo — em toda navegação, o dia
              inteiro. A operadora de balcão opera no teclado. */}
          <a
            href="#conteudo"
            className={cn(
              'sr-only focus:not-sr-only',
              'focus:absolute focus:left-3 focus:top-3 focus:z-50',
              'focus:rounded-md focus:bg-acento focus:px-3 focus:py-2',
              'focus:text-sm focus:font-medium focus:text-acento-contraste',
            )}
          >
            Pular para o conteúdo
          </a>

          <Topbar aoAbrirMenu={() => setMenuAberto(true)} />

          {/* `tabIndex={-1}` é obrigatório: sem ele vários navegadores movem a
              âncora mas não o foco, e o link de pular não pula nada. */}
          <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 p-3 md:p-5">
            {children}
          </main>
        </div>
      </Dialog.Root>
    </div>
  )
}
