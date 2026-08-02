import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mesNaLoja, mesPorExtenso, mesVizinho, type Mes } from '@/modules/relatorios/periodo'

/**
 * Voltar e avançar um mês, e um atalho para o mês corrente.
 *
 * **São links, não botões com estado.** O mês vive na URL (`?mes=2026-07`), e
 * isso resolve de graça três coisas que costumam faltar em relatório: o dono
 * manda o link do mês fechado para o contador e o contador vê o mesmo número;
 * o botão de voltar do navegador volta um mês, que é o que a pessoa espera; e a
 * página inteira continua sendo Server Component, sem um kilobyte de JavaScript
 * para trocar de período.
 *
 * Avançar para o futuro fica desabilitado. Não é preciosismo: um DRE de
 * setembro em agosto mostra tudo zerado, e um relatório todo zerado é
 * indistinguível de um relatório quebrado.
 */
export function NavegadorMes({
  mes,
  base,
  className,
}: {
  mes: Mes
  /** Rota da tela, sem query. Ex.: `/relatorios/dre`. */
  base: string
  className?: string
}) {
  const atual = mesNaLoja()
  const anterior = mesVizinho(mes, -1)
  const proximo = mesVizinho(mes, 1)
  const noFuturo = proximo > atual
  const ehAtual = mes === atual

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Link
        href={`${base}?mes=${anterior}`}
        aria-label={`Mês anterior — ${mesPorExtenso(anterior)}`}
        className="grid size-11 shrink-0 place-items-center rounded-md border border-borda-controle bg-superficie text-texto-suave shadow-sm hover:bg-superficie-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:size-8"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>

      {/* O mês por extenso e não `07/2026`: é o rótulo do relatório inteiro, e
          é para ele que o olho volta ao conferir contra o papel.

          `first-letter:uppercase` e não `capitalize`, pelo mesmo motivo que a
          tela de movimentos de vasilhame já anota: `capitalize` maiúsculiza
          toda palavra e escreve "Agosto De 2026". E `inline-block` junto,
          porque `::first-letter` não se aplica a caixa inline. */}
      <span className="inline-block min-w-[10.5rem] px-2 text-center text-sm font-medium tabular-nums text-texto first-letter:uppercase">
        {mesPorExtenso(mes)}
      </span>

      {noFuturo ? (
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-md border border-borda bg-superficie-afundada text-texto-fraco md:size-8"
        >
          <ChevronRight className="size-4" />
        </span>
      ) : (
        <Link
          href={`${base}?mes=${proximo}`}
          aria-label={`Próximo mês — ${mesPorExtenso(proximo)}`}
          className="grid size-11 shrink-0 place-items-center rounded-md border border-borda-controle bg-superficie text-texto-suave shadow-sm hover:bg-superficie-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:size-8"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}

      {!ehAtual && (
        <Link
          href={base}
          className="ml-1 hidden rounded-md px-2 py-1 text-xs font-medium text-acento-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco sm:block"
        >
          Mês atual
        </Link>
      )}
    </div>
  )
}
