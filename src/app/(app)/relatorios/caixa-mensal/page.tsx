import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, CalendarRange, Scale } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { GraficoArea } from '@/components/ui/graficos'
import { cn, moeda } from '@/lib/utils'
import { caixaMensal } from '@/modules/relatorios/consultas'
import { mesCurto, mesNaLoja, mesPorExtenso } from '@/modules/relatorios/periodo'

export const metadata: Metadata = { title: 'Fluxo de Caixa Mensal' }

/**
 * Fluxo de Caixa Mensal — **doze meses, sempre.**
 *
 * Um relatório anual que lista só os meses existentes na tabela mostra dez
 * linhas quando dois meses não tiveram lançamento — e o dono abre o ano para
 * encontrar o ano faltando pedaço, sem nada que diga se o negócio parou ou se
 * o relatório esqueceu. Mês vazio é resposta, e precisa aparecer zerado.
 *
 * Aqui os doze meses existem porque o calendário os tem. Mês sem movimento
 * aparece zerado e esmaecido, que é uma resposta — a linha ausente não é.
 *
 * Não tem navegador de mês: a tela **é** o período. Doze meses terminando no
 * corrente é a janela em que se compara agosto com agosto do ano passado, que é
 * a leitura que uma distribuidora de água faz — o verão vende mais.
 */
export default async function PaginaCaixaMensal() {
  const meses = await caixaMensal(12)
  const atual = mesNaLoja()

  const entradas = meses.reduce((s, m) => s + m.entrada, 0)
  const saidas = meses.reduce((s, m) => s + m.saida, 0)
  const comMovimento = meses.filter((m) => m.quantidade > 0).length
  const melhor = meses.reduce((a, b) => (b.entrada > a.entrada ? b : a), meses[0])

  const cartoes = [
    {
      rotulo: 'Entrou em 12 meses',
      valor: moeda(entradas),
      // "1 de 12 meses", nunca "1 de 12 mês": quem manda no plural aqui é o
      // doze, não a contagem de meses com lançamento.
      detalhe: `${comMovimento} de 12 meses com movimento`,
      Icone: ArrowDownLeft,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Saiu em 12 meses',
      valor: moeda(saidas),
      detalhe: 'pagamentos e estornos',
      Icone: ArrowUpRight,
      tom: saidas > 0 ? ('perigo' as const) : ('cat-2' as const),
    },
    {
      rotulo: 'Resultado no período',
      valor: moeda(entradas - saidas),
      detalhe: entradas - saidas >= 0 ? 'entrou mais do que saiu' : 'saiu mais do que entrou',
      Icone: Scale,
      tom: entradas - saidas >= 0 ? ('cat-1' as const) : ('alerta' as const),
    },
    {
      rotulo: 'Melhor mês',
      valor: melhor && melhor.entrada > 0 ? moeda(melhor.entrada) : '—',
      // O único cartão cujo detalhe é um nome próprio de mês, e o único que
      // começa com maiúscula. Os outros três são frases.
      detalhe:
        melhor && melhor.entrada > 0 ? (
          <span className="inline-block first-letter:uppercase">
            {mesPorExtenso(melhor.mes)}
          </span>
        ) : (
          'ainda sem movimento'
        ),
      Icone: CalendarRange,
      tom: 'cat-4' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Fluxo de Caixa Mensal"
        descricao="Os últimos doze meses — inclusive os que não tiveram movimento"
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

      {/* Área e não colunas.

          Coluna é para comparar duas ou três alturas lado a lado; aqui são doze
          pontos de uma série só, e a leitura é a tendência do ano. A diferença
          aparece inteira no celular: `GraficoColunas` imprime o valor sobre
          cada coluna e reserva a mesma fatia de largura para cada rótulo, o
          que em 390px dá 32px por mês — os valores encavalavam e os meses
          viravam "s…", "o…", "n…". O de área põe o valor só no ponto tocado e
          posiciona o rótulo pelo mesmo cálculo do ponto. */}
      <Card className="p-4 md:p-5">
        <h2 className="text-sm font-semibold text-texto">Entradas por mês</h2>
        <p className="mb-6 mt-0.5 text-xs text-texto-suave">
          toque em um mês para ver o valor · o mês corrente ainda está correndo
        </p>
        <GraficoArea
          serie={meses.map((m) => ({
            rotulo: mesCurto(m.mes),
            valor: m.entrada,
            parcial: m.mes === atual,
          }))}
          titulo="Entradas de caixa nos últimos doze meses"
          formato="moeda"
          altura={150}
          eixo
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Mês a mês</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-borda text-2xs uppercase tracking-wide text-texto-fraco">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Mês
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
                  Lançamentos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda/60">
              {meses.map((m) => {
                const parado = m.quantidade === 0
                return (
                  <tr key={m.mes} className={cn(parado && 'text-texto-fraco')}>
                    <td className="px-4 py-1.5">
                      {/* O mês leva ao Diário: é sempre a próxima pergunta —
                          "por que março entrou tão pouco?" se responde olhando
                          os 31 dias, não este total. */}
                      <Link
                        href={`/relatorios/caixa-diario?mes=${m.mes}`}
                        className={cn(
                          'inline-block rounded first-letter:uppercase hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                          m.mes === atual && 'font-medium text-texto',
                        )}
                      >
                        {mesPorExtenso(m.mes)}
                      </Link>
                      {m.mes === atual && (
                        <span className="ml-2 text-2xs text-texto-fraco">em curso</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        m.entrada > 0 && 'text-sucesso',
                      )}
                    >
                      {m.entrada > 0 ? moeda(m.entrada) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        m.saida > 0 && 'text-perigo',
                      )}
                    >
                      {m.saida > 0 ? moeda(m.saida) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-1.5 text-right tabular-nums',
                        !parado && 'font-medium text-texto',
                        m.saldo < 0 && 'text-perigo',
                      )}
                    >
                      {parado ? '—' : moeda(m.saldo)}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-texto-suave">
                      {m.quantidade || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-borda bg-superficie-afundada font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-sucesso">
                  {moeda(entradas)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-perigo">
                  {moeda(saidas)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-texto">
                  {moeda(entradas - saidas)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-texto-suave">
                  {meses.reduce((s, m) => s + m.quantidade, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
