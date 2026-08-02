'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ICONES_ITEM, NAVEGACAO } from '@/lib/navegacao'
import { GlifoCasco } from '@/components/marca/glifo-casco'
import { cn } from '@/lib/utils'

const CHAVE_RETRAIDA = 'casco-sidebar'

/**
 * Carimba `data-sidebar` no `<html>` antes da primeira pintura — mesmo
 * mecanismo do `scriptTema`, e pelo mesmo motivo: sem isto, a sidebar sempre
 * nasceria expandida e só encolheria depois do React hidratar, com um salto
 * de largura visível bem no primeiro instante da tela. Injetado em
 * `layout.tsx`.
 */
export const scriptSidebar = `
(function(){try{
  var p = localStorage.getItem('${CHAVE_RETRAIDA}');
  document.documentElement.setAttribute('data-sidebar', p === 'retraida' ? 'retraida' : 'expandida');
}catch(e){}})();
`

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
      <div className="flex items-center gap-2 px-4 py-3 retraida:justify-center retraida:px-0">
        <div
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md bg-acento text-acento-contraste"
        >
          <GlifoCasco className="size-4" />
        </div>
        <span className="overflow-hidden whitespace-nowrap text-base font-semibold tracking-tight text-texto transition-[opacity,width] duration-150 retraida:w-0 retraida:opacity-0">
          Casco
        </span>
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
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-superficie px-2 py-1.5 retraida:justify-center retraida:px-0">
                <grupo.Icone className="size-3.5 shrink-0 text-texto-fraco" aria-hidden />
                {/* `span`, não `h2`. Rótulo de grupo de menu não é seção de
                    documento: colocá-lo no outline faria os 8 grupos virem
                    antes do `h1` em TODAS as telas, queimando a navegação por
                    cabeçalho — que é a principal ferramenta de skim de quem usa
                    leitor de tela. O `aria-labelledby` abaixo mantém o grupo
                    anunciado ("lista Financeiro, 4 itens") sem esse custo, e o
                    `id` continua no DOM retraído — só o texto encolhe. */}
                <span
                  id={idGrupo}
                  className="overflow-hidden whitespace-nowrap text-2xs font-medium uppercase tracking-wide text-texto-fraco transition-[opacity,width] duration-150 retraida:w-0 retraida:opacity-0"
                >
                  {grupo.rotulo}
                </span>
              </div>

              <ul aria-labelledby={idGrupo} className="space-y-0.5">
                {grupo.itens.map((item) => {
                  const ativo = caminho === item.href
                  // Cada item com o próprio ícone, e não só o do grupo: numa
                  // lista de quatro rótulos parecidos ("Contas a Receber",
                  // "Contas a Pagar", "Caixa", "Contas e Formas"), o ícone é o
                  // que se reconhece num relance, antes de ler a palavra — é
                  // a diferença entre escanear o menu e ler o menu inteiro
                  // toda vez que se precisa trocar de tela.
                  const IconeItem = ICONES_ITEM[item.href] ?? grupo.Icone
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={aoNavegar}
                        // `aria-current` é o que informa o leitor de tela sobre
                        // a página atual. Cor sozinha não comunica isso.
                        aria-current={ativo ? 'page' : undefined}
                        // Some no lugar do rótulo escondido: retraída, a
                        // sidebar não mostra texto nenhum, e o título nativo
                        // do navegador é o que devolve o nome ao passar o
                        // mouse — sem puxar um componente de tooltip só para
                        // isto.
                        title={item.rotulo}
                        className={cn(
                          // 44px no toque, compacto no desktop.
                          'flex min-h-11 items-center gap-2.5 rounded-md py-2 pl-3 pr-3 md:min-h-0 md:py-1',
                          'text-sm transition-colors duration-150 retraida:justify-center retraida:px-0',
                          // Contorno para dentro, para não ser cortado pelo
                          // contêiner de rolagem.
                          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foco',
                          ativo
                            ? // Barra de acento à esquerda: o preenchimento do
                              // ativo tem só 1.07:1 contra a superfície, então
                              // quem varre a sidebar com o olho procurando
                              // "onde estou" precisa de uma âncora de forma,
                              // não só de cor. Continua com a sidebar retraída
                              // — é a única pista de "onde estou" que sobra
                              // sem o rótulo.
                              'border-l-2 border-acento bg-acento-suave pl-[10px] font-medium text-acento-texto retraida:pl-0'
                            : 'text-texto-suave hover:bg-superficie-hover hover:text-texto',
                        )}
                      >
                        {/* Sem cor própria: herda `currentColor` do `Link`, que
                            já muda com `ativo` — problema resolvido de graça,
                            sem duplicar a condição aqui. */}
                        <IconeItem className="size-4 shrink-0" aria-hidden />
                        <span className="truncate transition-[opacity,width] duration-150 retraida:w-0 retraida:opacity-0">
                          {item.rotulo}
                        </span>
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

/**
 * Sidebar fixa do desktop, com retrair/expandir. No mobile ela vira o drawer
 * do `AppShell` — ver a nota do `.sidebar-desktop` em `globals.css` sobre por
 * que o drawer nunca retrai, mesmo com a preferência salva.
 *
 * **A largura muda por CSS, nunca por `style` do React**, via `.sidebar-caixa`
 * em `globals.css` — regra escrita à mão, não o utilitário `retraida:` do
 * Tailwind. As duas tentativas com o utilitário arbitrário mediram a largura
 * sem mudança nenhuma no Chrome, apesar do seletor bater e a regra aparecer
 * compilada; a versão em CSS puro não depende de adivinhar por que. O ganho
 * que a abordagem original buscava continua de pé: nenhum `useState` decide o
 * número, nenhum re-render em cascata, nenhuma chance de a largura do
 * primeiro paint discordar da que o `scriptSidebar` já carimbou. O estado do
 * React abaixo existe só para o botão saber que ícone mostrar.
 */
export function Sidebar() {
  const [retraida, setRetraida] = React.useState(false)

  React.useEffect(() => {
    setRetraida(document.documentElement.getAttribute('data-sidebar') === 'retraida')
  }, [])

  function alternar() {
    const novo = !retraida
    setRetraida(novo)
    document.documentElement.setAttribute('data-sidebar', novo ? 'retraida' : 'expandida')
    localStorage.setItem(CHAVE_RETRAIDA, novo ? 'retraida' : 'expandida')
  }

  return (
    // `sidebar-desktop` marca "estamos no desktop" e não carrega largura
    // nenhuma — quem muda de largura é sempre a div de dentro, uma
    // descendente de verdade. Ver a nota longa em `globals.css`: a primeira
    // versão pôs a largura na PRÓPRIA div marcada, e o `retraida:` nunca
    // tinha como casar com o elemento que ele mesmo está em cima.
    <div className="sidebar-desktop hidden shrink-0 md:block">
      {/* `div` e não `aside`: `aside` é landmark de conteúdo complementar, e
          o menu principal não é tangencial. O `nav` de dentro já é o
          landmark certo. `relative` é para o botão de alternar, ancorado na
          borda desta caixa — a que de fato muda de largura. */}
      <div
        // `sidebar-caixa` é quem tem largura de verdade — ver `globals.css` e
        // a nota acima sobre por que não é `w-60`/`retraida:w-[...]`.
        className="sidebar-caixa relative sticky top-0 h-dvh border-r border-borda bg-superficie"
      >
        <ConteudoSidebar />

        <button
          type="button"
          onClick={alternar}
          aria-expanded={!retraida}
          aria-label={retraida ? 'Expandir menu' : 'Retrair menu'}
          title={retraida ? 'Expandir menu' : 'Retrair menu'}
          className={cn(
            // Metade para dentro, metade para fora da borda — o formato que
            // avisa "isto empurra a borda ao lado", sem precisar de legenda.
            'absolute -right-3 top-16 z-10 grid size-6 place-items-center rounded-full',
            'border border-borda-controle bg-superficie text-texto-suave shadow-sm',
            'hover:bg-superficie-hover hover:text-texto',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
          )}
        >
          {retraida ? (
            <ChevronRight className="size-3.5" aria-hidden />
          ) : (
            <ChevronLeft className="size-3.5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}
