import type { Metadata } from 'next'
import { TrendingDown } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Card } from '@/components/ui/card'
import { listarMovimentos, perdasPorMes } from '@/modules/vasilhame/consultas'
import { resumoDePerda } from '@/modules/vasilhame/esquema'
import { TabelaMovimentos } from './tabela-movimentos'

export const metadata: Metadata = { title: 'Movimentos de Vasilhame' }

function moeda(valor: string | number): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * `2026-08` → `agosto de 2026`.
 *
 * Em UTC nos dois lados, e não no fuso da distribuidora como o resto das datas:
 * isto é um balde de mês, não um instante. Construir a data em UTC e formatar
 * em `America/Belem` daria 31 de julho às 21h — e o cartão de agosto apareceria
 * escrito "julho".
 */
function nomeDoMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, 1)).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PaginaMovimentos() {
  const [linhas, perdas] = await Promise.all([listarMovimentos(), perdasPorMes(6)])

  // Agrupado na renderização e não no banco: a view já devolve mês × motivo, e
  // pedir um segundo agregado só para somar de novo seria uma viagem a mais
  // para uma conta de seis linhas.
  const porMes = new Map<string, { unidades: number; custo: number; motivos: string[] }>()
  for (const p of perdas) {
    const atual = porMes.get(p.mes) ?? { unidades: 0, custo: 0, motivos: [] }
    atual.unidades += Number(p.unidades)
    atual.custo += Number(p.custo)
    atual.motivos.push(resumoDePerda(p.motivo, Number(p.unidades)))
    porMes.set(p.mes, atual)
  }
  const meses = [...porMes.entries()]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Movimentos de Vasilhame"
        descricao="Todo vasilhame que entrou, saiu ou se perdeu — com motivo e responsável"
      />

      {meses.length > 0 && (
        <Card className="p-4 md:p-5">
          <div className="mb-3 flex items-start gap-2">
            <TrendingDown className="mt-0.5 size-4 shrink-0 text-perigo" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-texto">Perda de vasilhame</h2>
              {/*
                A frase fica na tela, não só na documentação: vasilhame perdido
                é prejuízo, e lançá-lo como venda inflaria o faturamento com um
                custo. O aviso existe para que ninguém leia este bloco como
                receita.
              */}
              <p className="mt-0.5 text-xs text-texto-suave">
                Custo do mês, não receita. Nenhum destes lançamentos entra no faturamento nem
                no caixa.
              </p>
            </div>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {meses.map(([mes, dados]) => (
              <li
                key={mes}
                className="rounded-md border border-borda bg-superficie-afundada px-3 py-2"
              >
                {/* `first-letter` e não `capitalize`: `capitalize` maiúsculiza
                    toda palavra e escreve "Agosto De 2026". */}
                <p className="text-xs text-texto-suave first-letter:uppercase">
                  {nomeDoMes(mes)}
                </p>
                <p className="text-lg font-semibold tabular-nums text-perigo">
                  {moeda(dados.custo)}
                </p>
                {/* O total de vasilhames só aparece quando há mais de um motivo:
                    com um só, "3 vasilhames · 3 quebrados" diz o mesmo número
                    duas vezes. */}
                <p className="text-xs text-texto-fraco">
                  {dados.motivos.length > 1 &&
                    `${dados.unidades} ${dados.unidades === 1 ? 'vasilhame' : 'vasilhames'} · `}
                  {dados.motivos.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TabelaMovimentos linhas={linhas} />
    </div>
  )
}
