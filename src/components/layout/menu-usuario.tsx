'use client'

import { ChevronDown, LogOut } from 'lucide-react'
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from '@/components/ui/menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { sair } from '@/modules/auth/acoes'
import { cn } from '@/lib/utils'

const PAPEL: Record<string, string> = {
  dono: 'Dono',
  operador: 'Operador',
  entregador: 'Entregador',
}

/**
 * Quem está logado e por onde se sai.
 *
 * Mostrar a empresa junto do nome não é enfeite: o Casco é multi-tenant, e o
 * dia em que alguém da Aionix abrir o sistema com a sessão errada, o nome da
 * distribuidora na topbar é o que denuncia antes de um lançamento ir para o
 * lugar errado.
 */
export function MenuUsuario({
  nome,
  empresa,
  papel,
}: {
  nome: string
  empresa: string
  papel: string
}) {
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <Menu>
      <MenuGatilho
        className={cn(
          'flex h-11 items-center gap-2 rounded-md px-2 md:h-9',
          'text-texto-suave hover:bg-superficie-hover hover:text-texto',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
        )}
        aria-label={`Conta de ${nome}`}
      >
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-acento-suave text-2xs font-semibold text-acento-texto"
        >
          {iniciais || '?'}
        </span>
        {/* O nome some no celular, onde a topbar já carrega título e menu.
            As iniciais continuam, para a conta não ficar invisível. */}
        <span className="hidden max-w-[12ch] truncate text-sm font-medium sm:block">{nome}</span>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </MenuGatilho>

      <MenuConteudo>
        <MenuRotulo>{empresa}</MenuRotulo>
        <div className="px-2 pb-1.5">
          <p className="truncate text-sm font-medium text-texto">{nome}</p>
          <p className="text-xs text-texto-fraco">{PAPEL[papel] ?? papel}</p>
        </div>

        <MenuSeparador />

        {/* O seletor de tema, **só no celular**.

            Na topbar ele ocupava 140px dos 390px do telefone — 36% da largura,
            em toda tela, para uma preferência que se ajusta uma vez e não se
            toca mais. O que sobrava para o título eram 76px, medidos: "Fluxo
            de Caixa Mensal" virava "Fluxo d…" e as duas telas de fluxo ficavam
            indistinguíveis exatamente onde o usuário precisa saber onde está.

            Aqui dentro ele mantém os 44px de alvo e ganha o rótulo "Tema", que
            na barra não cabia. No desktop nada muda: lá a largura sobra, e o
            seletor continua a um clique de distância. */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 md:hidden">
          <span className="text-sm text-texto-suave">Tema</span>
          <ThemeToggle />
        </div>

        <MenuSeparador className="md:hidden" />

        {/* `<form action>` e não `onSelect` chamando a action: sair precisa
            funcionar mesmo se o JavaScript falhar em carregar. Botão de sair
            que não sai é falha de segurança — num balcão compartilhado, a
            próxima pessoa herda a sessão de quem achou que tinha saído.

            O `preventDefault` é o detalhe que faz funcionar: por padrão o Radix
            fecha o menu ao selecionar o item, e fechar desmonta o formulário no
            mesmo instante em que o envio começa — o clique respondia, o menu
            sumia e a sessão continuava aberta. Segurando o menu aberto, o envio
            termina; a navegação para o login fecha tudo logo depois. */}
        <form action={sair}>
          <MenuItem asChild onSelect={(e) => e.preventDefault()}>
            <button type="submit" className="w-full">
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </MenuItem>
        </form>
      </MenuConteudo>
    </Menu>
  )
}
