import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Landmark, Scale, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { moeda } from '@/lib/utils'
import { listarCaixa, metricasCaixa, saldosPorConta } from '@/modules/financeiro/consultas'
import { TabelaCaixa } from './tabela-caixa'

export const metadata: Metadata = { title: 'Caixa' }

export default async function PaginaCaixa() {
  const [linhas, contas, m] = await Promise.all([
    listarCaixa(),
    saldosPorConta(),
    metricasCaixa(),
  ])

  const saldoTotal = contas.reduce((soma, c) => soma + Number(c.saldo), 0)
  const doDia = Number(m.entradasHoje) - Number(m.saidasHoje)

  const cartoes = [
    {
      rotulo: 'Entrou hoje',
      valor: moeda(Number(m.entradasHoje)),
      detalhe: `${m.qtdHoje} ${m.qtdHoje === 1 ? 'movimento' : 'movimentos'} no dia`,
      Icone: ArrowDownLeft,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Saiu hoje',
      valor: moeda(Number(m.saidasHoje)),
      detalhe: 'pagamentos e estornos',
      Icone: ArrowUpRight,
      // Vermelho só quando saiu dinheiro de verdade. Cartão em alarme
      // permanente com R$ 0,00 ensina a ignorar a cor em uma semana.
      tom: Number(m.saidasHoje) > 0 ? ('perigo' as const) : ('cat-2' as const),
    },
    {
      rotulo: 'Resultado do dia',
      valor: moeda(doDia),
      detalhe: doDia >= 0 ? 'entrou mais do que saiu' : 'saiu mais do que entrou',
      Icone: Scale,
      tom: doDia >= 0 ? ('cat-1' as const) : ('alerta' as const),
    },
    {
      rotulo: 'Saldo em conta',
      valor: moeda(saldoTotal),
      detalhe: `${contas.length} ${contas.length === 1 ? 'conta ativa' : 'contas ativas'}`,
      Icone: Landmark,
      tom: 'cat-3' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Caixa"
        descricao="Só o dinheiro que entrou e saiu de fato — a taxa da maquininha já descontada"
        acoes={
          <Button asChild variant="secundario">
            <Link href="/financeiro/caixa/abertura">
              <Wallet aria-hidden />
              Abertura de Caixa
            </Link>
          </Button>
        }
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

      {contas.length > 0 && (
        <Card className="p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold text-texto">Saldo por conta</h2>
          <ul className="divide-y divide-borda text-sm">
            {contas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate text-texto">
                  {c.nome}
                  <span className="ml-1.5 text-xs text-texto-fraco">
                    {c.tipo === 'caixa' ? 'caixa' : 'banco'}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs tabular-nums text-texto-suave sm:block">
                  no mês: <span className="text-sucesso">+{moeda(Number(c.entradasMes))}</span>{' '}
                  <span className="text-perigo">−{moeda(Number(c.saidasMes))}</span>
                </span>
                <span
                  className={
                    Number(c.saldo) < 0
                      ? 'w-28 shrink-0 text-right font-semibold tabular-nums text-perigo'
                      : 'w-28 shrink-0 text-right font-semibold tabular-nums text-texto'
                  }
                >
                  {moeda(Number(c.saldo))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TabelaCaixa linhas={linhas} />
    </div>
  )
}
