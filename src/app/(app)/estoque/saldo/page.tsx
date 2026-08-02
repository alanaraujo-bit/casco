import type { Metadata } from 'next'
import { Boxes, CircleSlash, TriangleAlert, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { moeda } from '@/lib/utils'
import { listarSaldos, metricasEstoque } from '@/modules/estoque/consultas'
import { TabelaSaldo } from './tabela-saldo'

export const metadata: Metadata = { title: 'Saldo em Estoque' }

export default async function PaginaSaldoEstoque() {
  const [linhas, metricas] = await Promise.all([listarSaldos(), metricasEstoque()])

  const cartoes = [
    {
      rotulo: 'Itens controlados',
      valor: metricas.itens.toLocaleString('pt-BR'),
      Icone: Boxes,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Abaixo do mínimo',
      valor: metricas.abaixoDoMinimo.toLocaleString('pt-BR'),
      Icone: TriangleAlert,
      tom: metricas.abaixoDoMinimo > 0 ? ('alerta' as const) : ('cat-3' as const),
    },
    {
      rotulo: 'Sem estoque',
      valor: metricas.semEstoque.toLocaleString('pt-BR'),
      Icone: CircleSlash,
      tom: metricas.semEstoque > 0 ? ('perigo' as const) : ('cat-3' as const),
    },
    {
      rotulo: 'Valor em estoque',
      valor: moeda(metricas.valorTotal),
      Icone: Wallet,
      tom: 'cat-4' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Saldo em Estoque"
        descricao="Quanto tem de cada produto, ao custo médio de aquisição"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <TabelaSaldo linhas={linhas} />
    </div>
  )
}
