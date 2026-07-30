'use client'

import { useTransition } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from '@/components/ui/menu'
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
  const [saindo, iniciarSaida] = useTransition()

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

        <MenuItem
          disabled={saindo}
          // `onSelect` do Radix e não `onClick`: cobre Enter e Espaço além do
          // clique, e fecha o menu antes de a navegação começar.
          onSelect={() => iniciarSaida(() => void sair())}
        >
          <LogOut className="size-4" aria-hidden />
          {saindo ? 'Saindo…' : 'Sair'}
        </MenuItem>
      </MenuConteudo>
    </Menu>
  )
}
