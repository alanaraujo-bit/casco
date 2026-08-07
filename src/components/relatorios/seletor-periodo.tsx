import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PERIODOS, ROTULO_PERIODO, type Periodo } from '@/modules/entregadores/desempenho'

/**
 * As quatro janelas de tempo, como links.
 *
 * **São links, não botões com estado** — a mesma escolha do `NavegadorMes`, e
 * pelos mesmos três motivos: o período vive na URL, então o dono manda o link da
 * semana passada para quem quiser ver o mesmo número; o botão voltar do
 * navegador volta o período; e a página inteira continua sendo Server Component,
 * sem um kilobyte de JavaScript para trocar de janela.
 *
 * Rola na horizontal no celular em vez de quebrar em duas linhas: quatro chips
 * empilhados empurrariam os cartões para fora da primeira dobra, que é onde
 * mora a resposta que a pessoa abriu a tela para ver.
 */
export function SeletorPeriodo({
  periodo,
  base,
  className,
}: {
  periodo: Periodo
  /** Rota da tela, sem query. Ex.: `/relatorios/entregadores`. */
  base: string
  className?: string
}) {
  return (
    <nav
      aria-label="Período"
      className={cn(
        '-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1 py-0.5',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {PERIODOS.map((p) => {
        const ativo = p === periodo
        return (
          <Link
            key={p}
            href={p === 'semana' ? base : `${base}?periodo=${p}`}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-md border px-3 py-2 text-sm font-medium whitespace-nowrap',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
              'md:py-1.5 md:text-xs',
              ativo
                ? 'border-acento-suave-borda bg-acento-suave text-acento-texto'
                : 'border-borda-controle bg-superficie text-texto-suave shadow-sm hover:bg-superficie-hover hover:text-texto',
            )}
          >
            {ROTULO_PERIODO[p]}
          </Link>
        )
      })}
    </nav>
  )
}
