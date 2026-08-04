import type { Metadata } from 'next'
import Link from 'next/link'
import { Boxes, Droplet, Flame, Tag } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { listarProdutos, metricasProdutos } from '@/modules/produtos/consultas'
import { TabelaProdutos } from './tabela-produtos'

export const metadata: Metadata = { title: 'Produtos' }

export default async function PaginaProdutos({
  searchParams,
}: {
  searchParams: Promise<{ inativos?: string }>
}) {
  const incluirInativos = (await searchParams).inativos === '1'
  const [linhas, metricas] = await Promise.all([
    listarProdutos({ incluirInativos }),
    metricasProdutos(),
  ])

  const cartoes = [
    {
      rotulo: 'Água em estoque',
      valor: metricas.aguas.toLocaleString('pt-BR'),
      Icone: Droplet,
      tom: 'cat-4' as const,
    },
    {
      rotulo: 'Vasilhame em estoque',
      valor: metricas.vasilhames.toLocaleString('pt-BR'),
      Icone: Boxes,
      tom: 'cat-3' as const,
    },
    {
      rotulo: 'Gás em estoque',
      valor: metricas.gas.toLocaleString('pt-BR'),
      Icone: Flame,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Sem preço',
      valor: metricas.semPreco.toLocaleString('pt-BR'),
      Icone: Tag,
      tom: metricas.semPreco > 0 ? ('alerta' as const) : ('cat-2' as const),
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Produtos"
        descricao="Cadastro de produtos, preço e controle de estoque"
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

      <TabelaProdutos linhas={linhas} incluirInativos={incluirInativos} />
    </div>
  )
}
