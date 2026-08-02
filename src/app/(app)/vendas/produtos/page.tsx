import type { Metadata } from 'next'
import { CalendarDays, CreditCard, Receipt, TrendingUp } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { moeda } from '@/lib/utils'
import { listarVendas, metricasVendas } from '@/modules/vendas/consultas'
import { TabelaVendas } from './tabela-vendas'

export const metadata: Metadata = { title: 'Vendas de Produtos' }

export default async function PaginaVendas() {
  const [linhas, m] = await Promise.all([listarVendas(), metricasVendas()])

  const cartoes = [
    {
      rotulo: 'Vendido hoje',
      valor: moeda(Number(m.totalHoje)),
      detalhe: `${m.qtdHoje} ${m.qtdHoje === 1 ? 'venda' : 'vendas'}`,
      Icone: Receipt,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Vendido no mês',
      valor: moeda(Number(m.totalMes)),
      detalhe: `${m.qtdTotal} ${m.qtdTotal === 1 ? 'venda no total' : 'vendas no total'}`,
      Icone: CalendarDays,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Ticket médio',
      valor: moeda(Number(m.ticketMedio)),
      detalhe: 'por venda confirmada',
      Icone: TrendingUp,
      tom: 'cat-2' as const,
    },
    {
      // Não é um número "informativo": é dinheiro que o dono acha que
      // recebeu e não recebeu.
      rotulo: 'Taxas no mês',
      valor: moeda(Number(m.taxasMes)),
      detalhe: 'o que a maquininha levou',
      Icone: CreditCard,
      tom: Number(m.taxasMes) > 0 ? ('alerta' as const) : ('cat-3' as const),
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Vendas de Produtos"
        descricao="Tudo que foi vendido — o que entrou no caixa e o que ficou a receber"
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

      <TabelaVendas linhas={linhas} />
    </div>
  )
}
