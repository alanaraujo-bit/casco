import type { Metadata } from 'next'
import { ArrowDown, Boxes, Droplet, Flame, TriangleAlert, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { moeda, quantidade as fmtQtd } from '@/lib/utils'
import { listarMovimentos, metricasMovimentos } from '@/modules/estoque/consultas'
import { TabelaMovimentos } from './tabela-movimentos'

export const metadata: Metadata = { title: 'Movimentações' }

export default async function PaginaMovimentosEstoque() {
  const [linhas, metricas] = await Promise.all([listarMovimentos(), metricasMovimentos()])

  const cartoes = [
    {
      rotulo: 'Água entrou no mês',
      valor: fmtQtd(metricas.entradasAguaMes),
      Icone: Droplet,
      tom: 'cat-4' as const,
    },
    {
      rotulo: 'Vasilhame entrou no mês',
      valor: fmtQtd(metricas.entradasVasilhameMes),
      Icone: Boxes,
      tom: 'cat-3' as const,
    },
    {
      rotulo: 'Gás entrou no mês',
      valor: fmtQtd(metricas.entradasGasMes),
      Icone: Flame,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Saiu no mês',
      valor: fmtQtd(metricas.saidasMes),
      Icone: ArrowDown,
      tom: 'cat-2' as const,
    },
    {
      rotulo: 'Comprado/produzido no mês',
      valor: moeda(metricas.valorEntradasMes),
      Icone: Wallet,
      tom: 'cat-5' as const,
    },
    {
      // Sai da mesma regra da view `estoque_perdas`, que o DRE vai ler: sem
      // isso o número da tela e o do contador começariam a divergir aqui.
      rotulo: 'Perda no mês',
      valor: moeda(metricas.perdaMes),
      Icone: TriangleAlert,
      tom: metricas.perdaMes > 0 ? ('perigo' as const) : ('cat-6' as const),
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Movimentações"
        descricao="Todo lançamento que mexeu no saldo, com quem lançou e quando — inclusive o que foi estornado ou excluído"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cartoes.map((m) => (
          <Card key={m.rotulo} className="flex items-center gap-3 p-3">
            <Chip Icone={m.Icone} tom={m.tom} tamanho="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs text-texto-suave">{m.rotulo}</p>
              <p className="text-lg font-semibold tabular-nums text-texto">{m.valor}</p>
            </div>
          </Card>
        ))}
      </div>

      <TabelaMovimentos linhas={linhas} />
    </div>
  )
}
