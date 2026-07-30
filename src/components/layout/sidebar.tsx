'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAVEGACAO } from '@/lib/navegacao'
import { cn } from '@/lib/utils'

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')

export function ConteudoSidebar({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname()

  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <div
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md bg-acento text-acento-contraste text-sm font-bold"
        >
          C
        </div>
        <span className="text-base font-semibold tracking-tight text-texto">Casco</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {NAVEGACAO.map((grupo) => {
          const idGrupo = `grupo-${slug(grupo.rotulo)}`
          return (
            <div key={grupo.rotulo} className="mb-3 last:mb-0">
              {/* Grudento dentro do contêiner de rolagem: o menu tem ~1060px
                  e a área visível fica em torno de 590px num Chrome
                  maximizado em 1366×768, então rolar é inevitável. O problema
                  real não é a rolagem, é perder a referência de onde se está —
                  e isso o rótulo fixo resolve sem tirar nada da tela. */}
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-superficie px-2 py-1.5">
                <grupo.Icone className="size-3.5 shrink-0 text-texto-fraco" aria-hidden />
                {/* `span`, não `h2`. Rótulo de grupo de menu não é seção de
                    documento: colocá-lo no outline faria os 8 grupos virem
                    antes do `h1` em TODAS as telas, queimando a navegação por
                    cabeçalho — que é a principal ferramenta de skim de quem usa
                    leitor de tela. O `aria-labelledby` abaixo mantém o grupo
                    anunciado ("lista Financeiro, 4 itens") sem esse custo. */}
                <span
                  id={idGrupo}
                  className="text-2xs font-medium uppercase tracking-wide text-texto-fraco"
                >
                  {grupo.rotulo}
                </span>
              </div>

              <ul aria-labelledby={idGrupo} className="space-y-0.5">
                {grupo.itens.map((item) => {
                  const ativo = caminho === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={aoNavegar}
                        // `aria-current` é o que informa o leitor de tela sobre
                        // a página atual. Cor sozinha não comunica isso.
                        aria-current={ativo ? 'page' : undefined}
                        className={cn(
                          // 44px no toque, compacto no desktop.
                          'flex min-h-11 items-center gap-2 rounded-md py-2 pl-8 pr-3 md:min-h-0 md:py-1',
                          'text-sm transition-colors duration-150',
                          // Contorno para dentro, para não ser cortado pelo
                          // contêiner de rolagem.
                          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foco',
                          ativo
                            ? // Barra de acento à esquerda: o preenchimento do
                              // ativo tem só 1.07:1 contra a superfície, então
                              // quem varre a sidebar com o olho procurando
                              // "onde estou" precisa de uma âncora de forma,
                              // não só de cor.
                              'border-l-2 border-acento bg-acento-suave pl-[30px] font-medium text-acento-texto'
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
          )
        })}
      </div>
    </nav>
  )
}

/** Sidebar fixa do desktop. No mobile ela vira o drawer do AppShell. */
export function Sidebar() {
  return (
    // `div` e não `aside`: `aside` é landmark de conteúdo complementar, e o
    // menu principal não é tangencial. O `nav` de dentro já é o landmark certo.
    <div className="hidden w-60 shrink-0 border-r border-borda bg-superficie md:block">
      <div className="sticky top-0 h-dvh">
        <ConteudoSidebar />
      </div>
    </div>
  )
}
