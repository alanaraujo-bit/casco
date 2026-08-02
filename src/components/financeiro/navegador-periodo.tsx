import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mesNaLoja, mesPorExtenso, mesVizinho, type Mes } from '@/modules/relatorios/periodo'

/**
 * Navegar por mês, com "todo o período" como terceiro estado — não só os
 * dois que `NavegadorMes` (relatórios) conhece.
 *
 * A diferença de propósito: um relatório sempre é de um mês, porque "DRE de
 * todo o período" não significa nada — mistura custo congelado de anos
 * diferentes. Contas a pagar e a receber são o contrário: a pergunta mais
 * comum é "o que falta pagar", sem recorte de mês nenhum, e só depois "e em
 * agosto, especificamente?". Por isso aqui a ausência de `?mes=` **é** um
 * estado de primeira classe, não um valor inválido a corrigir para hoje.
 *
 * Continua em link, não em estado de cliente, pelo mesmo motivo do
 * `NavegadorMes`: o mês vive na URL, então dá para mandar o link do mês
 * fechado e a página inteira continua sendo Server Component.
 */
export function NavegadorPeriodo({
  mes,
  base,
  className,
}: {
  /** `undefined` é "todo o período". */
  mes?: Mes
  base: string
  className?: string
}) {
  // Sem mês selecionado, as setas orbitam o mês corrente: é o ponto de partida
  // mais provável de quem clica numa seta a partir de "todo o período".
  const pivo = mes ?? mesNaLoja()
  const anterior = mesVizinho(pivo, mes ? -1 : 0)
  const proximo = mesVizinho(pivo, mes ? 1 : 0)

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Link
        href={`${base}?mes=${anterior}`}
        aria-label={`Mês anterior — ${mesPorExtenso(anterior)}`}
        className="grid size-11 shrink-0 place-items-center rounded-md border border-borda-controle bg-superficie text-texto-suave shadow-sm hover:bg-superficie-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:size-8"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>

      <span className="inline-flex min-w-[9.5rem] items-center justify-center gap-1.5 px-2 text-center text-sm font-medium text-texto">
        {mes ? (
          <span className="tabular-nums first-letter:uppercase">{mesPorExtenso(mes)}</span>
        ) : (
          <>
            <span>Todo o período</span>
            {/* O rótulo que a cliente já reconhece do sistema que ela usava:
                "Geral" é o que aparece quando nenhum filtro de mês está
                ativo. Mantido aqui de propósito — ver a regra de vocabulário
                do AGENTS.md. */}
            <span className="rounded bg-superficie-afundada px-1.5 py-0.5 text-2xs font-medium text-texto-fraco">
              Geral
            </span>
          </>
        )}
      </span>

      <Link
        href={`${base}?mes=${proximo}`}
        aria-label={`Próximo mês — ${mesPorExtenso(proximo)}`}
        className="grid size-11 shrink-0 place-items-center rounded-md border border-borda-controle bg-superficie text-texto-suave shadow-sm hover:bg-superficie-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:size-8"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>

      {mes && (
        <Link
          href={base}
          className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-acento-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Ver tudo
        </Link>
      )}
    </div>
  )
}
