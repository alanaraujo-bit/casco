import type { Metadata } from 'next'
import { ArrowDownLeft, ArrowUpRight, Landmark, Scale } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { NavegadorMes } from '@/components/relatorios/navegador-mes'
import { Card } from '@/components/ui/card'
import { cn, moeda } from '@/lib/utils'
import { caixaDiario, saldoAntesDoMes } from '@/modules/relatorios/consultas'
import { mesPorExtenso, mesValido } from '@/modules/relatorios/periodo'

export const metadata: Metadata = { title: 'Fluxo de Caixa Diário' }

/**
 * Fluxo de Caixa Diário.
 *
 * Colunas na ordem consagrada: Data · Dia Semana ·
 * Entrada · Saída · Saldo. A coluna "Banco" deles não veio: aqui o dinheiro de
 * várias contas cabe no mesmo dia, e repetir a linha por conta transformaria um
 * relatório de 31 linhas em um de 90. O saldo por conta já é a tela de Caixa.
 *
 * O que foi acrescentado é o **acumulado**. A coluna "Saldo" sozinha responde
 * "sobrou quanto na terça?"; ninguém abre um fluxo de caixa para saber isso. A
 * pergunta é quanto há em caixa em cada dia — e para respondê-la o acumulado
 * começa do saldo que existia antes do mês virar, não de zero.
 *
 * **Perda de vasilhame não aparece aqui, e é de propósito.** Galão quebrado é
 * custo e desce o DRE, mas nenhum real sai da gaveta quando ele quebra.
 */
export default async function PaginaCaixaDiario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const mes = mesValido((await searchParams).mes)
  const [dias, saldoInicial] = await Promise.all([caixaDiario(mes), saldoAntesDoMes(mes)])

  const entradas = dias.reduce((s, d) => s + d.entrada, 0)
  const saidas = dias.reduce((s, d) => s + d.saida, 0)
  const saldoFinal = saldoInicial + entradas - saidas
  const comMovimento = dias.filter((d) => d.quantidade > 0).length

  const cartoes = [
    {
      rotulo: 'Entrou no mês',
      valor: moeda(entradas),
      detalhe: `${comMovimento} ${comMovimento === 1 ? 'dia com movimento' : 'dias com movimento'}`,
      Icone: ArrowDownLeft,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Saiu no mês',
      valor: moeda(saidas),
      detalhe: 'pagamentos e estornos',
      Icone: ArrowUpRight,
      // Vermelho só quando saiu dinheiro de verdade. Alarme permanente em
      // R$ 0,00 some da vista numa semana.
      tom: saidas > 0 ? ('perigo' as const) : ('cat-2' as const),
    },
    {
      rotulo: 'Resultado do mês',
      valor: moeda(entradas - saidas),
      detalhe: entradas - saidas >= 0 ? 'entrou mais do que saiu' : 'saiu mais do que entrou',
      Icone: Scale,
      tom: entradas - saidas >= 0 ? ('cat-1' as const) : ('alerta' as const),
    },
    {
      rotulo: 'Saldo no fim do mês',
      valor: moeda(saldoFinal),
      detalhe: `começou em ${moeda(saldoInicial)}`,
      Icone: Landmark,
      tom: 'cat-3' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Fluxo de Caixa Diário"
        descricao="Só o dinheiro que entrou e saiu de fato, dia a dia"
        acoes={<NavegadorMes mes={mes} base="/relatorios/caixa-diario" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => (
          <Card key={c.rotulo} className="flex items-center gap-3 p-3">
            <Chip Icone={c.Icone} tom={c.tom} tamanho="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs text-texto-suave">{c.rotulo}</p>
              <p className="text-lg font-semibold tabular-nums text-texto">{c.valor}</p>
              <p className="truncate text-2xs text-texto-fraco">{c.detalhe}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabela de verdade, e não a `TabelaDados`: os 31 dias não se ordenam
          nem se filtram — a ordem cronológica *é* o relatório, e o acumulado da
          última linha só faz sentido depois de todas as anteriores. Reordenar
          por "maior entrada" produziria uma coluna de acumulado sem
          significado nenhum. */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">
            Movimento de {mesPorExtenso(mes)}
          </h2>
          <p className="text-xs text-texto-suave">
            saldo anterior <span className="tabular-nums text-texto">{moeda(saldoInicial)}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-borda text-2xs uppercase tracking-wide text-texto-fraco">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Data
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Dia Semana
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Entrada
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Saída
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Saldo
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda/60">
              {dias.map((d) => {
                const parado = d.quantidade === 0
                return (
                  <tr
                    key={d.data}
                    className={cn(
                      // Dia sem movimento fica esmaecido em vez de sumir. Ele é
                      // informação — "não entrou nada na segunda" — e a linha
                      // ausente é justamente o defeito do relatório deles.
                      parado && 'text-texto-fraco',
                      d.fimDeSemana && 'bg-superficie-afundada/40',
                    )}
                  >
                    <td className="px-4 py-1.5 tabular-nums">{d.dataBr}</td>
                    {/* `first-letter` e não `capitalize`: o Chrome trata o
                        hífen como separador de palavra e escreve
                        "Segunda-Feira". */}
                    <td className="px-4 py-1.5">
                      <span className="inline-block first-letter:uppercase">{d.diaSemana}</span>
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        !parado && d.entrada > 0 && 'text-sucesso',
                      )}
                    >
                      {d.entrada > 0 ? moeda(d.entrada) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        !parado && d.saida > 0 && 'text-perigo',
                      )}
                    >
                      {d.saida > 0 ? moeda(d.saida) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        !parado && 'font-medium text-texto',
                        d.saldo < 0 && 'text-perigo',
                      )}
                    >
                      {parado ? '—' : moeda(d.saldo)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        d.acumulado + saldoInicial < 0 ? 'text-perigo' : 'text-texto-suave',
                      )}
                    >
                      {moeda(saldoInicial + d.acumulado)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-borda bg-superficie-afundada font-semibold">
                <td className="px-4 py-2.5" colSpan={2}>
                  Total do mês
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-sucesso">
                  {moeda(entradas)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-perigo">
                  {moeda(saidas)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-texto">
                  {moeda(entradas - saidas)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-texto">
                  {moeda(saldoFinal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
