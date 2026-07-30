'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAVEGACAO } from '@/lib/navegacao'
import { cn } from '@/lib/utils'

export function ConteudoSidebar({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname()

  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md bg-acento text-acento-contraste text-sm font-bold"
        >
          C
        </div>
        <span className="text-base font-semibold tracking-tight text-texto">Casco</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {NAVEGACAO.map((grupo) => (
          <div key={grupo.rotulo} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <grupo.Icone className="size-3.5 shrink-0 text-texto-fraco" aria-hidden />
              <h2 className="text-2xs font-medium uppercase tracking-wide text-texto-fraco">
                {grupo.rotulo}
              </h2>
            </div>

            <ul className="space-y-0.5">
              {grupo.itens.map((item) => {
                const ativo = caminho === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={aoNavegar}
                      // `aria-current` é o que informa o leitor de tela sobre a
                      // página atual. Cor sozinha não comunica isso.
                      aria-current={ativo ? 'page' : undefined}
                      className={cn(
                        // 44px no toque, compacto no desktop — o mesmo
                        // raciocínio dos botões.
                        'flex min-h-11 items-center gap-2 rounded-md py-2 pl-8 pr-3 md:min-h-0 md:py-1.5',
                        'text-sm transition-colors duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foco',
                        ativo
                          ? 'bg-acento-suave font-medium text-acento-texto'
                          : 'text-texto-suave hover:bg-superficie-hover hover:text-texto',
                      )}
                    >
                      <span className="truncate">{item.rotulo}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

/** Sidebar fixa do desktop. No mobile ela vira o drawer do AppShell. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-borda bg-superficie md:block">
      <div className="sticky top-0 h-dvh">
        <ConteudoSidebar />
      </div>
    </aside>
  )
}
