import type { Metadata } from 'next'
import { AlertTriangle, CalendarClock, CircleCheck, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { moeda } from '@/lib/utils'
import { listarContasPagar, metricasPagar } from '@/modules/financeiro/consultas'
import { TabelaPagar } from './tabela-pagar'

export const metadata: Metadata = { title: 'Contas a Pagar' }

export default async function PaginaPagar() {
  const [linhas, m] = await Promise.all([listarContasPagar(), metricasPagar()])

  const cartoes = [
    {
      rotulo: 'Em aberto',
      valor: moeda(Number(m.emAberto)),
      detalhe: `${m.qtdAberto} ${m.qtdAberto === 1 ? 'conta' : 'contas'}`,
      Icone: Wallet,
      tom: 'cat-1' as const,
    },
    {
      // Para-brisa, não retrovisor: é o que ainda dá para organizar.
      rotulo: 'Vence em 7 dias',
      valor: moeda(Number(m.venceEm7)),
      detalhe: 'o que dá para se preparar',
      Icone: CalendarClock,
      tom: 'alerta' as const,
    },
    {
      rotulo: 'Vencido',
      valor: moeda(Number(m.vencido)),
      detalhe: `${m.qtdVencido} ${m.qtdVencido === 1 ? 'conta' : 'contas'}`,
      Icone: AlertTriangle,
      // Vermelho só quando há vencido de verdade — cartão em alarme permanente
      // ensina a ignorar a cor em uma semana.
      tom: m.qtdVencido > 0 ? ('perigo' as const) : ('cat-2' as const),
    },
    {
      rotulo: 'Pago no mês',
      valor: moeda(Number(m.pagoMes)),
      detalhe: `${moeda(Number(m.custoMes))} disso é custo`,
      Icone: CircleCheck,
      tom: 'sucesso' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Contas a Pagar"
        descricao="O que a distribuidora deve, separado entre custo e despesa"
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

      <TabelaPagar linhas={linhas} />
    </div>
  )
}
