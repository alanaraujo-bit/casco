import type { Metadata } from 'next'
import Link from 'next/link'
import { Droplets, PackageX, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { NavegadorMes } from '@/components/relatorios/navegador-mes'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { GraficoArea } from '@/components/ui/graficos'
import { cn, moeda } from '@/lib/utils'
import {
  despesasPorCategoria,
  dreDoMes,
  perdasDoMes,
  resultadoPorMes,
} from '@/modules/relatorios/consultas'
import { mesCurto, mesPorExtenso, mesValido } from '@/modules/relatorios/periodo'

export const metadata: Metadata = { title: 'DRE' }

/**
 * Demonstrativo de Resultado do Exercício.
 *
 * **O relatório que está quebrado no sistema que estamos substituindo.** Lá as
 * linhas de custo e despesa exibem literalmente `NaN`, e o lucro líquido junto
 * (auditoria §4a) — o número mais importante para o dono da distribuidora é o
 * único que a tela não sabe dizer. `NaN` não nasce de conta errada: nasce de
 * dividir por um total que ninguém garantiu que existe, e de somar colunas que
 * podem vir nulas. As duas coisas são tratadas explicitamente aqui.
 *
 * Regime de **competência**: o mês em que o fato aconteceu, não o mês em que o
 * dinheiro andou. A venda a prazo de julho é receita de julho mesmo que as três
 * parcelas caiam entre agosto e outubro. Quem responde pelo dinheiro é o Fluxo
 * de Caixa, e a diferença entre os dois é a resposta para "vendi bem e estou
 * sem dinheiro na conta".
 *
 * A linha de perda de vasilhame é a razão de existir do produto. No sistema
 * deles um galão quebrado vira venda de R$ 0,13 e **sobe** o faturamento
 * (auditoria §5); aqui ele desce o resultado, com o nome do que aconteceu.
 */

/* -------------------------------------------------------------------------- */

type Nivel = 'total' | 'subtotal' | 'deducao'

/**
 * Uma linha do demonstrativo.
 *
 * `percentual` recebe `null` — e não `0` — quando não há base para calcular.
 * É a diferença entre a tela dizer "não houve receita neste mês" e afirmar
 * "esta despesa foi 0,0% da receita", que é falso e é como o relatório deles
 * chega no `NaN`: `0/0` em JavaScript não estoura, só contamina tudo que toca.
 */
function Linha({
  rotulo,
  valor,
  percentual,
  nivel = 'deducao',
  detalhe,
  Icone,
  negativoBom = false,
}: {
  rotulo: string
  valor: number
  percentual: number | null
  nivel?: Nivel
  detalhe?: React.ReactNode
  Icone?: React.ComponentType<{ className?: string }>
  /** Total cujo sinal negativo é notícia ruim — o resultado do mês. */
  negativoBom?: boolean
}) {
  const total = nivel === 'total'
  const subtotal = nivel === 'subtotal'
  const ruim = negativoBom && valor < 0

  return (
    <div
      className={cn(
        'flex items-baseline gap-3 px-4 py-2',
        total && 'bg-superficie-afundada py-3',
        subtotal && 'border-y border-borda bg-superficie-afundada/40',
      )}
    >
      {/* O rótulo **quebra**, não trunca. Com `truncate` a linha mais
          importante do bloco de custo virava "(−) C..." no celular — e é
          justamente ali que o dono olha o resultado, fora da loja. Uma linha
          de duas alturas custa 20px; uma linha sem nome não custa nada e não
          informa nada. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        {Icone && <Icone className="size-3.5 shrink-0 self-center text-texto-fraco" />}
        <span
          className={cn(
            'min-w-0',
            total && 'text-sm font-semibold uppercase tracking-wide text-texto',
            subtotal && 'text-sm font-medium text-texto',
            nivel === 'deducao' && 'text-sm text-texto-suave',
          )}
        >
          {rotulo}
        </span>
        {detalhe && <span className="shrink-0 text-2xs text-texto-fraco">{detalhe}</span>}
      </div>

      {/* Largura fixa nas duas colunas de número: o olho desce a coluna
          conferindo contra o papel, e valor que dança de posição obriga a
          reencontrar a casa decimal em cada linha. Mais estreita no celular,
          para devolver espaço ao rótulo — nenhum valor da JM passa de
          R$ 999.999,99, e a coluna já cabe com folga. */}
      <span
        className={cn(
          'w-[6.5rem] shrink-0 text-right tabular-nums sm:w-36',
          total ? 'text-base font-semibold' : 'text-sm',
          ruim ? 'text-perigo' : total || subtotal ? 'text-texto' : 'text-texto-suave',
        )}
      >
        {nivel === 'deducao' && valor > 0 ? `(${moeda(valor)})` : moeda(valor)}
      </span>

      <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-texto-fraco sm:block">
        {percentual === null ? '—' : `${percentual.toFixed(1).replace('.', ',')}%`}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export default async function PaginaDre({
  searchParams,
}: {
  // Assíncrono e ponto: acesso síncrono a `searchParams` foi removido no Next 16.
  searchParams: Promise<{ mes?: string }>
}) {
  const mes = mesValido((await searchParams).mes)

  const [d, despesas, perdas, serie] = await Promise.all([
    dreDoMes(mes),
    despesasPorCategoria(mes),
    perdasDoMes(mes),
    resultadoPorMes(12),
  ])

  const receitaLiquida = d.receitaBruta - d.descontos
  const lucroBruto = receitaLiquida - d.cmv
  const perdas_ = d.perdaVasilhame + d.perdaProduto
  const resultado = lucroBruto - d.taxas - perdas_ - d.despesas - d.outrosCustos

  /**
   * A base da análise vertical, e a origem do `NaN` deles.
   *
   * Sem receita no mês não existe "x% da receita" — existe uma divisão por
   * zero. A escolha aqui é devolver `null` e a tela mostrar um travessão, em
   * vez de inventar 0,0% (que afirma algo falso) ou deixar o `NaN` vazar
   * (que é o que o sistema antigo faz).
   */
  const pct = (valor: number) =>
    receitaLiquida === 0 ? null : (valor / receitaLiquida) * 100

  const margem = receitaLiquida === 0 ? null : (resultado / receitaLiquida) * 100
  const semMovimento = receitaLiquida === 0 && d.despesas === 0 && d.outrosCustos === 0 && perdas_ === 0

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="DRE"
        descricao="Demonstrativo de Resultado — por competência, no mês em que o fato aconteceu"
        acoes={<NavegadorMes mes={mes} base="/relatorios/dre" />}
      />

      {semMovimento ? (
        <Card className="p-6 text-center sm:p-10">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <Chip Icone={Receipt} tom="cat-2" />
            <h2 className="text-base font-medium text-texto">
              Nenhum lançamento em {mesPorExtenso(mes)}
            </h2>
            <p className="text-sm text-texto-suave">
              O demonstrativo se monta sozinho a partir das vendas, das saídas de estoque
              e das contas a pagar do mês. Use as setas acima para conferir outro período.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ o demonstrativo */}
          <Card className="overflow-hidden">
            <div className="flex items-baseline gap-3 border-b border-borda px-4 py-3">
              <h2 className="min-w-0 flex-1 text-sm font-semibold text-texto">
                {/* Minúsculo de propósito: aqui o mês está no meio da frase. */}
                Resultado de {mesPorExtenso(mes)}
              </h2>
              <span className="hidden w-16 shrink-0 text-right text-2xs uppercase tracking-wide text-texto-fraco sm:block">
                % rec. líq.
              </span>
            </div>

            <div className="divide-y divide-borda/60">
              <Linha
                rotulo="Receita bruta de vendas"
                valor={d.receitaBruta}
                percentual={pct(d.receitaBruta)}
                nivel="subtotal"
                detalhe={`${d.qtdVendas} ${d.qtdVendas === 1 ? 'venda' : 'vendas'}`}
              />
              <Linha
                rotulo="(−) Descontos concedidos"
                valor={d.descontos}
                percentual={pct(d.descontos)}
              />
              <Linha
                rotulo="Receita líquida"
                valor={receitaLiquida}
                percentual={receitaLiquida === 0 ? null : 100}
                nivel="subtotal"
              />

              <Linha
                rotulo="(−) Custo das mercadorias vendidas"
                valor={d.cmv}
                percentual={pct(d.cmv)}
                detalhe="ao custo médio da saída"
              />
              <Linha
                rotulo="Lucro bruto"
                valor={lucroBruto}
                percentual={pct(lucroBruto)}
                nivel="subtotal"
              />

              <Linha
                rotulo="(−) Taxas de cartão"
                valor={d.taxas}
                percentual={pct(d.taxas)}
                Icone={Receipt}
              />
              <Linha
                rotulo="(−) Perda de vasilhame"
                valor={d.perdaVasilhame}
                percentual={pct(d.perdaVasilhame)}
                Icone={Droplets}
                detalhe={
                  d.perdaVasilhameUnidades > 0
                    ? `${d.perdaVasilhameUnidades} ${d.perdaVasilhameUnidades === 1 ? 'galão' : 'galões'}`
                    : undefined
                }
              />
              <Linha
                rotulo="(−) Perda de produto"
                valor={d.perdaProduto}
                percentual={pct(d.perdaProduto)}
                Icone={PackageX}
              />
              <Linha
                rotulo="(−) Despesas operacionais"
                valor={d.despesas}
                percentual={pct(d.despesas)}
              />
              <Linha
                rotulo="(−) Outros custos"
                valor={d.outrosCustos}
                percentual={pct(d.outrosCustos)}
              />

              <Linha
                rotulo="Resultado do mês"
                valor={resultado}
                percentual={margem}
                nivel="total"
                negativoBom
              />
            </div>

            {/* A nota que separa este DRE do deles. Fica na tela, não na
                documentação: quem confere o número é quem precisa lê-la. */}
            <p className="border-t border-borda px-4 py-3 text-2xs leading-relaxed text-texto-fraco">
              A compra de mercadoria não aparece como despesa: ela vira custo quando o
              produto <em>sai</em>, pela linha do CMV. Contá-la nos dois lugares somaria a
              mesma compra duas vezes. A perda de vasilhame entra aqui e{' '}
              <strong className="font-medium">não</strong> no Fluxo de Caixa — quando um
              galão quebra, nenhum dinheiro sai da gaveta.
            </p>
          </Card>

          {/* --------------------------------------------------- a lateral */}
          <div className="space-y-5">
            <Card className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-texto">Margem do mês</h2>
                  <p className="mt-0.5 text-2xs text-texto-suave">
                    quanto sobrou de cada real faturado
                  </p>
                </div>
                <Chip
                  Icone={resultado >= 0 ? TrendingUp : TrendingDown}
                  tom={resultado >= 0 ? 'sucesso' : 'perigo'}
                  tamanho="sm"
                />
              </div>
              <p
                className={cn(
                  'text-3xl font-semibold tabular-nums tracking-tight',
                  resultado >= 0 ? 'text-texto' : 'text-perigo',
                )}
              >
                {margem === null ? '—' : `${margem.toFixed(1).replace('.', ',')}%`}
              </p>
              <p className="mt-1 text-xs text-texto-suave">
                {margem === null
                  ? 'sem receita no mês para calcular'
                  : `${moeda(resultado)} sobre ${moeda(receitaLiquida)}`}
              </p>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold text-texto">Resultado nos 12 meses</h2>
              <p className="mb-4 mt-0.5 text-2xs text-texto-suave">
                receita líquida por mês, no fuso da loja
              </p>
              <GraficoArea
                serie={serie.map((s) => ({ rotulo: mesCurto(s.mes), valor: s.receita }))}
                titulo="Receita líquida dos últimos 12 meses"
                formato="moeda"
                altura={120}
                eixo={false}
              />
              <ul className="mt-4 space-y-1.5 text-xs">
                {serie
                  .slice(-4)
                  .reverse()
                  .map((s) => (
                    <li key={s.mes} className="flex items-baseline gap-2">
                      <Link
                        href={`/relatorios/dre?mes=${s.mes}`}
                        className={cn(
                          'min-w-0 flex-1 truncate rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                          s.mes === mes ? 'font-medium text-texto' : 'text-texto-suave',
                        )}
                      >
                        {mesCurto(s.mes)}
                      </Link>
                      <span className="shrink-0 tabular-nums text-texto-suave">
                        {moeda(s.receita)}
                      </span>
                      <span
                        className={cn(
                          'w-24 shrink-0 text-right tabular-nums',
                          s.resultado >= 0 ? 'text-sucesso' : 'text-perigo',
                        )}
                      >
                        {moeda(s.resultado)}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>

            {perdas.length > 0 && (
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-texto">Perda de vasilhame</h2>
                  <Badge variant="acento">só no Casco</Badge>
                </div>
                <ul className="space-y-2 text-sm">
                  {perdas.map((p) => (
                    <li key={p.motivo} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate capitalize text-texto-suave">
                        {p.motivo}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-texto-fraco">
                        {p.unidades} un
                      </span>
                      <span className="w-24 shrink-0 text-right tabular-nums text-texto">
                        {moeda(p.custo)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-2xs leading-relaxed text-texto-fraco">
                  No sistema antigo cada um destes galões virava uma venda de centavos e
                  <em> subia</em> o faturamento.
                </p>
              </Card>
            )}

            {despesas.length > 0 && (
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-texto">
                  Despesas por categoria
                </h2>
                <ul className="space-y-2 text-sm">
                  {despesas.map((c) => (
                    <li key={`${c.categoria}-${c.natureza}`} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-texto-suave">
                        {c.categoria}
                      </span>
                      <span className="shrink-0 text-2xs text-texto-fraco">
                        {c.quantidade}×
                      </span>
                      <span className="w-24 shrink-0 text-right tabular-nums text-texto">
                        {moeda(c.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
