'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Menu suspenso sobre o Radix. Só a aparência é nossa.
 *
 * O que o Radix resolve e não vale reimplementar: foco preso enquanto aberto,
 * devolução do foco ao gatilho no fecho, navegação por seta, busca por
 * digitação, `aria-expanded`/`aria-checked`, e o posicionamento que se vira
 * quando o menu não cabe embaixo. Cada um desses é um bug em potencial na
 * mão da operadora que opera no teclado o dia inteiro.
 */

export const Menu = DropdownMenu.Root
export const MenuGatilho = DropdownMenu.Trigger

export function MenuConteudo({
  className,
  align = 'end',
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        // `--radix-dropdown-menu-content-available-height` é o que impede o
        // menu de colunas (14 itens) de vazar para fora da tela no celular.
        className={cn(
          'z-50 min-w-[13rem] overflow-y-auto overflow-x-hidden',
          'max-h-[var(--radix-dropdown-menu-content-available-height)]',
          'rounded-lg border border-borda bg-superficie-elevada p-1 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function MenuRotulo({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        'px-2 py-1.5 text-2xs font-medium uppercase tracking-wide text-texto-fraco',
        className,
      )}
      {...props}
    />
  )
}

export function MenuSeparador({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn('-mx-1 my-1 h-px bg-borda', className)} {...props} />
}

const itemBase = [
  'relative flex cursor-default select-none items-center gap-2 rounded-md',
  // 40px no toque, 28px no ponteiro: o mesmo raciocínio dos botões.
  'px-2 py-2.5 text-sm md:py-1.5 md:text-xs',
  'text-texto outline-none',
  'data-[highlighted]:bg-superficie-hover',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
].join(' ')

export function MenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemBase, className)} {...props} />
}

export function MenuItemCheck({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem className={cn(itemBase, 'pl-7', className)} {...props}>
      <DropdownMenu.ItemIndicator className="absolute left-1.5 flex items-center">
        <Check className="size-3.5 text-acento-texto" aria-hidden />
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.CheckboxItem>
  )
}

export const MenuGrupoRadio = DropdownMenu.RadioGroup

export function MenuItemRadio({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemBase, 'pl-7', className)} {...props}>
      <DropdownMenu.ItemIndicator className="absolute left-1.5 flex items-center">
        <Check className="size-3.5 text-acento-texto" aria-hidden />
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.RadioItem>
  )
}
