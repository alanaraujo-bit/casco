import type { Metadata } from 'next'
import { Phone, Truck, UserX } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { listarEntregadores, metricasEntregadores } from '@/modules/entregadores/consultas'
import { TabelaEntregadores } from './tabela-entregadores'

export const metadata: Metadata = { title: 'Entregadores' }

export default async function PaginaEntregadores() {
  const [linhas, metricas] = await Promise.all([listarEntregadores(), metricasEntregadores()])

  const cartoes = [
    {
      rotulo: 'Total de entregadores',
      valor: metricas.total.toLocaleString('pt-BR'),
      Icone: Truck,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Com telefone',
      valor: `${metricas.comTelefone} de ${metricas.total}`,
      Icone: Phone,
      tom:
        metricas.total > 0 && metricas.comTelefone < metricas.total
          ? ('perigo' as const)
          : ('cat-2' as const),
    },
    {
      rotulo: 'Inativos',
      valor: metricas.inativos.toLocaleString('pt-BR'),
      Icone: UserX,
      tom: metricas.inativos > 0 ? ('alerta' as const) : ('cat-4' as const),
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Entregadores"
        descricao="Quem entrega a venda — aparece no PDV e no cupom"
      />

      <div className="grid gap-3 sm:grid-cols-3">
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

      <TabelaEntregadores linhas={linhas} />
    </div>
  )
}
