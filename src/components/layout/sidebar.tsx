'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { ICONES_ITEM, NAVEGACAO } from '@/lib/navegacao'
import { GlifoCasco } from '@/components/marca/glifo-casco'
import { BadgeContador } from '@/components/ui/badge-contador'
import { cn } from '@/lib/utils'

const CHAVE_RETRAIDA = 'casco-sidebar'

/**
 * Garante que a sidebar sempre inicie expandida.
 * A funcionalidade de retrair foi removida do desktop.
 */
export const scriptSidebar = `
(function(){try{
  document.documentElement.setAttribute('data-sidebar', 'expandida');
  localStorage.removeItem('${CHAVE_RETRAIDA}');
}catch(e){}})();
`

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')

/**
 * O grupo que contém a tela atual — não por igualdade exata, porque uma
 * ficha (`/cadastro/produtos/<uuid>`) não bate com o `href` da listagem
 * (`/cadastro/produtos`) que o item aponta. `startsWith` é o bastante para
 * decidir qual grupo abrir sozinho; a marcação de item ativo continua exata,
 * ali sim a diferença entre listagem e ficha importa.
 */
function acharGrupoDoCaminho(caminho: string): string | null {
  return NAVEGACAO.find((g) => g.itens.some((i) => caminho.startsWith(i.href)))?.rotulo ?? null
}

export function ConteudoSidebar({
  aoNavegar,
  naoLidosAtualizacoes = 0,
}: {
  aoNavegar?: () => void
  /** Contador do sino de "Central de Atualizações" — 0 não desenha nada. */
  naoLidosAtualizacoes?: number
}) {
  const caminho = usePathname()
  const grupoAtivo = React.useMemo(() => acharGrupoDoCaminho(caminho), [caminho])

  /**
   * Um grupo aberto por vez — abrir "Financeiro" fecha "Vendas". É a
   * sugestão que resolve o menu ficando mais alto que a tela (~1060px de
   * conteúdo contra ~590px visíveis num notebook comum): com tudo sempre
   * aberto, a rolagem era inevitável; com um grupo por vez, quase nunca é.
   *
   * Sincroniza com a navegação: trocar de tela reabre o grupo certo mesmo
   * que a operadora tivesse fechado tudo ou aberto outro só para espiar.
   * Inicializar direto do `grupoAtivo` (e não em um efeito) é o que evita a
   * primeira pintura mostrar tudo fechado por um instante e só depois abrir
   * o grupo certo.
   */
  const [grupoAberto, setGrupoAberto] = React.useState(grupoAtivo)
  React.useEffect(() => {
    setGrupoAberto(grupoAtivo)
  }, [grupoAtivo])

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
          const idLista = `${idGrupo}-lista`
          const aberto = grupoAberto === grupo.rotulo
          return (
            <div key={grupo.rotulo} className="mb-3 last:mb-0">
              {/* Grudento dentro do contêiner de rolagem: o menu tem ~1060px
                  e a área visível fica em torno de 590px num Chrome
                  maximizado em 1366×768 — por isso o acordeão abaixo, e não só
                  a sticky: com um grupo aberto por vez, quase nunca rola. */}
              <button
                type="button"
                onClick={() => setGrupoAberto(aberto ? null : grupo.rotulo)}
                aria-expanded={aberto}
                aria-controls={idLista}
                className="sticky top-0 z-10 flex w-full items-center gap-2 bg-superficie px-2 py-1.5 text-left retraida:justify-center retraida:px-0"
              >
                <grupo.Icone className="size-3.5 shrink-0 text-texto-fraco" aria-hidden />
                {/* `span`, não `h2`. Rótulo de grupo de menu não é seção de
                    documento: colocá-lo no outline faria os 8 grupos virem
                    antes do `h1` em TODAS as telas, queimando a navegação por
                    cabeçalho — que é a principal ferramenta de skim de quem usa
                    leitor de tela. O `id` seguindo no DOM retraído, só o texto
                    encolhendo, é o que mantém `aria-controls`/rótulo coerentes
                    nos dois estados da sidebar. */}
                <span
                  id={idGrupo}
                  className="flex-1 overflow-hidden whitespace-nowrap text-2xs font-medium uppercase tracking-wide text-texto-fraco transition-[opacity,width] duration-150 retraida:w-0 retraida:opacity-0"
                >
                  {grupo.rotulo}
                </span>
                {/* Escondida junto do rótulo: retraída, todo grupo já fica
                    sempre aberto (ver o `retraida:` na lista abaixo), então
                    uma seta de expandir/recolher não teria o que indicar. */}
                <ChevronDown
                  className={cn(
                    'size-3.5 shrink-0 text-texto-fraco transition-transform duration-200',
                    'retraida:hidden',
                    aberto && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>

              {/*
                O truque do grid animando `grid-template-rows` entre `0fr` e
                `1fr`: anima uma altura que nem React nem CSS sabem de
                antemão (a lista tem alturas diferentes por grupo), sem medir
                nada em JS e sem o "pulo" de um `max-height` arbitrário grande
                demais. `retraida:!grid-rows-[1fr]` força sempre aberto no
                rail de ícones — ali o acordeão atrapalharia o que o rail
                existe para dar: acesso a qualquer item num clique só.
              */}
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-200 ease-in-out',
                  aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  // Tailwind v4: o modificador de `!important` vem DEPOIS da
                  // utilidade (`classe!`), não antes como na v3.
                  'retraida:grid-rows-[1fr]!',
                )}
              >
                <ul
                  id={idLista}
                  aria-labelledby={idGrupo}
                  className="space-y-0.5 overflow-hidden"
                >
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
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate transition-[opacity,width] duration-150 retraida:w-0 retraida:opacity-0">
                          <span className="truncate">{item.rotulo}</span>
                          {item.href === '/atualizacoes' && (
                            <BadgeContador valor={naoLidosAtualizacoes} />
                          )}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                </ul>
              </div>
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
export function Sidebar({ naoLidosAtualizacoes = 0 }: { naoLidosAtualizacoes?: number }) {
  return (
    // `sidebar-desktop` marca "estamos no desktop" e não carrega largura
    // nenhuma — quem muda de largura é sempre a div de dentro, uma
    // descendente de verdade. Ver a nota longa em `globals.css`: a primeira
    // versão pôs a largura na PRÓPRIA div marcada, e o `retraida:` nunca
    // tinha como casar com o elemento que ele mesmo está em cima.
    <div className="sidebar-desktop hidden shrink-0 md:block print:hidden">
      {/* `div` e não `aside`: `aside` é landmark de conteúdo complementar, e
          o menu principal não é tangencial. O `nav` de dentro já é o
          landmark certo. */}
      <div
        // `sidebar-caixa` é quem tem largura de verdade — ver `globals.css` e
        // a nota acima sobre por que não é `w-60`/`retraida:w-[...]`.
        className="sidebar-caixa sticky top-0 h-dvh border-r border-borda bg-superficie"
      >
        <ConteudoSidebar naoLidosAtualizacoes={naoLidosAtualizacoes} />
      </div>
    </div>
  )
}
