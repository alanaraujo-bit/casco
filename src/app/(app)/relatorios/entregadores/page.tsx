import type { Metadata } from 'next'
import Link from 'next/link'
import { Droplets, PackageCheck, Trophy, Truck } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Bloco, Chip, corDoTom, type Tom } from '@/components/painel/pecas'
import { SeletorPeriodo } from '@/components/relatorios/seletor-periodo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EstadoVazio } from '@/components/ui/estados'
import { BarraProgresso, GraficoColunas } from '@/components/ui/graficos'
import { cn, moeda } from '@/lib/utils'
import {
  entregasPorDia,
  intervaloDoPeriodo,
  periodoValido,
  rankingEntregadores,
} from '@/modules/entregadores/desempenho'

export const metadata: Metadata = { title: 'Desempenho dos Entregadores' }

/** Um inteiro como a operadora lê: `1.240`. */
const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')

/** Cores do ranking, na ordem. Categóricas: identificam, não julgam. */
const TONS: Tom[] = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6']

/**
 * Desempenho dos Entregadores.
 *
 * A tela responde uma pergunta e a coloca primeiro: **quem entregou mais no
 * período.** Tudo o mais — água, vasilhame recolhido, clientes atendidos,
 * ticket médio — está aí para explicar o primeiro lugar, não para disputar
 * atenção com ele.
 *
 * O ranking é por **valor vendido**, e não por número de entregas. As duas
 * ordens divergem toda semana: quem faz muitas entregas pequenas de balcão
 * aparece na frente de quem levou a carga do mercado, e é o segundo que pagou o
 * mês. O número de entregas continua na tabela, para quem estiver perguntando
 * outra coisa.
 *
 * **A tela não pontua ninguém.** Não existe nota, meta nem selo de "abaixo do
 * esperado": o número aqui não sabe quem pegou a rota do interior e quem ficou
 * no balcão da esquina, e um sistema que emite julgamento sobre um dado que não
 * tem esse contexto começa a ser usado para brigar em vez de para decidir.
 */
export default async function PaginaDesempenhoEntregadores({
  searchParams,
}: PageProps<'/relatorios/entregadores'>) {
  const { periodo: bruto } = await searchParams
  // A barra de endereços aceita `?periodo=semana&periodo=mes`; o Next entrega
  // array nesse caso, e `periodoValido` cai no padrão em vez de quebrar.
  const periodo = periodoValido(Array.isArray(bruto) ? bruto[0] : bruto)
  const intervalo = intervaloDoPeriodo(periodo)

  const [linhas, dias] = await Promise.all([
    rankingEntregadores(intervalo.de, intervalo.ate),
    entregasPorDia(intervalo.de, intervalo.ate),
  ])

  const entregas = linhas.reduce((s, l) => s + l.entregas, 0)
  const agua = linhas.reduce((s, l) => s + l.agua, 0)
  const devolvido = linhas.reduce((s, l) => s + l.devolvido, 0)
  const valor = linhas.reduce((s, l) => s + l.valor, 0)

  // Só quem tem nome disputa o primeiro lugar — a linha "sem entregador
  // marcado" é uma pendência de registro, não um campeão de vendas.
  const comNome = linhas.filter((l) => l.id !== null)
  const semMarcacao = linhas.find((l) => l.id === null)
  const lider = comNome.find((l) => l.entregas > 0) ?? null
  const maiorValor = Math.max(...comNome.map((l) => l.valor), 1)

  const cartoes = [
    {
      rotulo: 'Entregas no período',
      valor: inteiro(entregas),
      detalhe: intervalo.detalhe,
      Icone: Truck,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Água entregue',
      valor: `${inteiro(agua)} ${agua === 1 ? 'galão' : 'galões'}`,
      detalhe: `${inteiro(devolvido)} ${devolvido === 1 ? 'vasilhame recolhido' : 'vasilhames recolhidos'}`,
      Icone: Droplets,
      tom: 'cat-2' as const,
    },
    {
      rotulo: 'Valor entregue',
      valor: moeda(valor),
      detalhe: `${moeda(entregas > 0 ? valor / entregas : 0)} por entrega`,
      Icone: PackageCheck,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Quem mais vendeu',
      valor: lider ? lider.nome : '—',
      detalhe: lider
        ? `${moeda(lider.valor)} em ${inteiro(lider.entregas)} ${lider.entregas === 1 ? 'entrega' : 'entregas'}`
        : 'ninguém entregou no período',
      Icone: Trophy,
      tom: 'acento' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Desempenho dos Entregadores"
        descricao="Quem entregou o quê no período — e quanto vasilhame voltou junto"
        acoes={<SeletorPeriodo periodo={periodo} base="/relatorios/entregadores" />}
      />

      {comNome.length === 0 ? (
        <Card>
          <EstadoVazio
            titulo="Nenhum entregador cadastrado"
            descricao="O desempenho sai das vendas que têm entregador marcado. Cadastre quem entrega e escolha o nome no PDV ao fechar a venda — a partir daí esta tela se preenche sozinha."
            acao={
              <Button asChild variant="primario">
                <Link href="/cadastro/entregadores/novo">Cadastrar entregador</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cartoes.map((c) => (
              <Card key={c.rotulo} className="flex items-center gap-3 p-3">
                <Chip Icone={c.Icone} tom={c.tom} tamanho="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs text-texto-suave">{c.rotulo}</p>
                  <p className="truncate text-lg font-semibold tabular-nums text-texto">
                    {c.valor}
                  </p>
                  <p className="truncate text-2xs text-texto-fraco">{c.detalhe}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco
              titulo="Ranking por valor vendido"
              descricao={`${intervalo.rotulo} · ${intervalo.detalhe}`}
            >
              {comNome.some((l) => l.valor > 0) ? (
                <ul className="space-y-3">
                  {comNome.slice(0, 8).map((l, i) => (
                    <li key={l.id}>
                      <BarraProgresso
                        rotulo={`${i + 1}. ${l.nome}`}
                        valor={l.valor}
                        maximo={maiorValor}
                        cor={corDoTom(TONS[i % TONS.length])}
                        formato="moeda"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-texto-suave">
                  Nenhuma venda com entregador marcado neste período.
                </p>
              )}
            </Bloco>

            <Bloco
              titulo="Entregas por dia"
              descricao="Dia parado aparece zerado — a coluna vazia também é informação"
            >
              <GraficoColunas
                serie={dias.map((d) => ({ rotulo: d.rotulo, valor: d.entregas }))}
                titulo={`Entregas por dia — ${intervalo.detalhe}`}
                formato="inteiro"
                destacarUltima={periodo === 'semana' || periodo === 'mes'}
                altura={140}
              />
            </Bloco>
          </div>

          {/* Tabela de verdade, e não a `TabelaDados`: são poucos nomes e a
              ordem *é* o ranking. Deixar reordenar por "clientes atendidos"
              produziria uma primeira linha que não é a resposta da tela. */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold text-texto">Detalhe por entregador</h2>
              <p className="text-xs text-texto-suave">
                {inteiro(entregas)} {entregas === 1 ? 'entrega' : 'entregas'} ·{' '}
                <span className="tabular-nums text-texto">{moeda(valor)}</span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-borda text-2xs uppercase tracking-wide text-texto-fraco">
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      Entregador
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Entregas
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Água
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Vasilhame recolhido
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Clientes
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Ticket médio
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Total vendido
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda/60">
                  {linhas.map((l) => {
                    const parado = l.entregas === 0
                    return (
                      <tr
                        key={l.id ?? 'sem-entregador'}
                        className={cn(
                          parado && 'text-texto-fraco',
                          l.id === null && 'bg-superficie-afundada/60',
                        )}
                      >
                        <td className="px-4 py-1.5">
                          <span className="flex items-center gap-2">
                            <span className={cn(!parado && 'font-medium text-texto')}>
                              {l.nome}
                            </span>
                            {!l.ativo && <Badge variant="neutro">inativo</Badge>}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {parado ? '—' : inteiro(l.entregas)}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {l.agua > 0 ? inteiro(l.agua) : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {l.devolvido > 0 ? inteiro(l.devolvido) : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {l.clientes > 0 ? inteiro(l.clientes) : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {parado ? '—' : moeda(l.ticket)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-1.5 text-right tabular-nums',
                            !parado && 'font-medium text-texto',
                          )}
                        >
                          {parado ? '—' : moeda(l.valor)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {semMarcacao && (
              // A frase que evita a conversa de "o relatório não bate": a
              // diferença entre a soma do ranking e o faturamento do período
              // tem nome, número e um caminho para resolver.
              <p className="border-t border-borda bg-superficie-afundada px-4 py-3 text-xs text-texto-suave">
                {inteiro(semMarcacao.entregas)}{' '}
                {semMarcacao.entregas === 1 ? 'venda saiu' : 'vendas saíram'} sem entregador
                marcado, somando{' '}
                <span className="tabular-nums text-texto">{moeda(semMarcacao.valor)}</span>. Esse
                valor não entra em nenhum nome acima. Dá para marcar depois:{' '}
                <Link
                  href="/vendas/produtos"
                  className="font-medium text-acento-texto hover:underline"
                >
                  abra a venda em Vendas de Produtos
                </Link>{' '}
                e escolha quem entregou.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
