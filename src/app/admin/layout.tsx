import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { exigirAdmin } from '@/lib/dal'
import { sair } from '@/modules/auth/acoes'

export const metadata: Metadata = { title: { default: 'Aionix', template: '%s · Aionix' } }

/**
 * Casca do painel interno da Aionix.
 *
 * Fora do grupo `(app)`, e sem sidebar: este não é o produto. É a portaria de
 * onde a gente escolhe em qual distribuidora entrar. Deliberadamente pobre —
 * cada minuto gasto aqui é um minuto que não foi para a tela que o cliente usa.
 *
 * O visual é o mesmo do sistema (mesmos tokens, mesmo tema) por um motivo
 * prático: quando isto crescer, cresce reaproveitando o que já existe, em vez
 * de virar um segundo design system para manter.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin()

  return (
    <div className="min-h-dvh bg-fundo">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-borda bg-superficie px-4
                   h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-5 shrink-0 text-acento-texto" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-texto">Aionix</p>
            <p className="truncate text-2xs text-texto-fraco">Administração do Casco</p>
          </div>
        </div>

        <div className="flex-1" />

        <span className="hidden max-w-[20ch] truncate text-sm text-texto-suave sm:block">
          {admin.nome}
        </span>
        <ThemeToggle />

        {/* `<form action>` e não `onClick`: sair precisa funcionar mesmo se o
            JavaScript não carregar. Mesma regra do menu de usuário do app. */}
        <form action={sair}>
          <Button type="submit" variant="fantasma" size="sm">
            Sair
          </Button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-3xl p-4 md:p-6">{children}</main>
    </div>
  )
}
