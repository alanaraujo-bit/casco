'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleHelp, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { ConteudoSidebar, Sidebar } from '@/components/layout/sidebar'
import { MenuUsuario } from '@/components/layout/menu-usuario'
import { FeedbackModal } from '@/components/feedback/feedback-modal'
import { voltarAoPainel } from '@/modules/admin/acoes'
import { acharItem } from '@/lib/navegacao'
import { cn } from '@/lib/utils'

/** Só o que a topbar precisa mostrar — não a sessão inteira. */
export interface UsuarioShell {
  nome: string
  empresa: string
  papel: string
  /** Quem está aqui é da Aionix, dando suporte — não é funcionário da empresa. */
  admin?: boolean
}

/**
 * Faixa de "você está dentro da empresa X".
 *
 * Existe para responder uma pergunta antes de ela ser feita: **em qual
 * distribuidora eu estou digitando?** Suporte com três abas abertas lança uma
 * baixa de vasilhame na empresa errada em dois segundos, e depois passa uma
 * hora descobrindo o que aconteceu — porque nada na tela era diferente.
 *
 * Fica grudada no topo junto da topbar, e não rolando com o conteúdo: o risco
 * não é na primeira tela, é na décima quinta, com a página já rolada.
 */
function FaixaAdmin({ empresa }: { empresa: string }) {
  return (
    <div className="flex items-center gap-2 bg-alerta-bg px-3 py-1.5 text-alerta md:px-5">
      <ShieldCheck className="size-4 shrink-0" aria-hidden />
      {/* No celular sobra o nome da empresa e mais nada.
          "Acesso Aionix em JM Distribui…" gasta 18 caracteres dizendo o que o
          ícone e a cor já dizem, e come justamente a única informação que a
          faixa existe para dar. O texto completo volta a partir de `sm`. */}
      <p className="min-w-0 flex-1 truncate text-xs">
        <span className="hidden sm:inline">Acesso Aionix em </span>
        <strong className="font-semibold">{empresa}</strong>
      </p>
      {/* `<form action>` de novo: sair da empresa apaga cookie, então é
          mudança de estado e precisa funcionar sem JavaScript. */}
      <form action={voltarAoPainel}>
        <button
          type="submit"
          // O rótulo acessível é fixo; só o visível encolhe. No celular o botão
          // mostra só "Sair" para dar largura ao nome da empresa, e "Sair" ao
          // lado do "Sair" da topbar seria ambiguidade num botão que troca o
          // contexto inteiro do sistema. Com `aria-label` o leitor de tela
          // anuncia a frase inteira nos dois tamanhos.
          aria-label="Sair da empresa"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5',
            'text-xs font-medium underline-offset-2 hover:underline',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
          )}
        >
          <LogOut className="size-3.5" aria-hidden />
          {/* String explícita e não texto solto no JSX: o espaço da frente
              seria comido na compilação, e viraria "Sairda empresa". */}
          Sair<span className="hidden sm:inline">{' da empresa'}</span>
        </button>
      </form>
    </div>
  )
}

function Topbar({
  aoAbrirMenu,
  usuario,
}: {
  aoAbrirMenu: () => void
  usuario?: UsuarioShell
}) {
  const caminho = usePathname()
  const item = acharItem(caminho)

  return (
    <header
      className={cn(
        'flex h-14 items-center gap-3 border-b border-borda bg-superficie px-3 md:px-5',
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

      <div className="min-w-0 flex-1 md:hidden">
        {/* Só no celular. No desktop quem manda é o `CabecalhoPagina` da tela,
            que fica logo abaixo — os dois juntos repetiam a mesma palavra duas
            vezes na mesma dobra, com dois `h1` na página. Duplicar título é o
            defeito que mais deixa uma interface com cara de montada por
            automação, e é falha de acessibilidade de quebra. */}
        {/* O nome inteiro da tela cabe aqui desde que o seletor de tema saiu da
            barra no celular (foi para o menu da conta). Antes sobravam 76px
            para o título — medidos — e "Fluxo de Caixa Mensal" virava
            "Fluxo d…", com as duas telas de fluxo indistinguíveis na barra.
            Encurtar o nome não era opção: o rótulo é o vocabulário do dia a
            dia da distribuidora, de propósito. */}
        <h1 className="truncate text-base font-semibold tracking-tight text-texto">
          {item?.rotulo ?? 'Casco'}
        </h1>
        {item && <p className="truncate text-2xs text-texto-fraco">{item.grupo}</p>}
      </div>

      {/* Empurra o seletor de tema para a direita quando o título some. */}
      <div className="hidden flex-1 md:block" />

      {/* Ao contrário do tema, ajuda não é preferência de uma vez: fica
          visível nos dois tamanhos, sempre a um toque — é o "?" que a
          operadora precisa achar sem pensar, na primeira vez que trava. */}
      <Link
        href="/ajuda"
        aria-label="Central de Ajuda"
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-md md:size-9',
          'text-texto-suave hover:bg-superficie-hover hover:text-texto',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
        )}
      >
        <CircleHelp className="size-5" aria-hidden />
      </Link>

      {/* Só quando há sessão: o `not-found.tsx` da raiz monta este shell sem
          usuário resolvido, e o relato precisa de quem relatou. */}
      {usuario && <FeedbackModal />}

      {/* Só a partir de `md`. No celular ele vive dentro do menu da conta —
          ver a nota lá. Tema é preferência que se ajusta uma vez; ocupar 36%
          da barra de um telefone com ela custava o título de toda tela. */}
      <ThemeToggle className="hidden md:inline-flex" />
      {/* Opcional porque o `not-found.tsx` da raiz também monta este shell, e
          ele é boundary de erro: renderiza fora do layout de `(app)`, onde a
          sessão pode não ter sido resolvida. */}
      {usuario && <MenuUsuario {...usuario} />}
    </header>
  )
}

export function AppShell({
  children,
  usuario,
}: {
  children: React.ReactNode
  usuario?: UsuarioShell
}) {
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
      {/* PRIMEIRO elemento do DOM, antes da sidebar — e isso é o ponto inteiro.
          A ordem de tabulação segue o DOM, não o layout: colocado depois da
          sidebar, o link viraria a 25ª parada e não pularia nada. A operadora
          de balcão opera no teclado; sem ele são 26 tabulações até o primeiro
          campo, em toda navegação, o dia inteiro. */}
      <a
        href="#conteudo"
        className={cn(
          'sr-only focus:not-sr-only',
          // `fixed` e não `absolute`: com `absolute` ele se posiciona contra o
          // topo do documento, então voltar com Shift+Tab no meio de uma
          // tabela longa faria o link aparecer fora da tela.
          'focus:fixed focus:left-3 focus:top-3 focus:z-[60]',
          'focus:rounded-md focus:bg-acento focus:px-3 focus:py-2',
          'focus:text-sm focus:font-medium focus:text-acento-contraste',
          'focus:outline-2 focus:outline-offset-2 focus:outline-foco',
        )}
      >
        Pular para o conteúdo
      </a>

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
          {/* A safe-area subiu do header para cá quando a faixa de admin
              nasceu: ela passa a ser o primeiro elemento sob o notch, e o
              inset precisa reservar espaço acima de quem estiver no topo —
              não dentro do header, que nem sempre é o primeiro. */}
          <div className="sticky top-0 z-20 pt-[env(safe-area-inset-top)] bg-superficie">
            {usuario?.admin && <FaixaAdmin empresa={usuario.empresa} />}
            <Topbar aoAbrirMenu={() => setMenuAberto(true)} usuario={usuario} />
          </div>

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
