import type { Metadata } from 'next'
import { Boxes, Droplet, Flame, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { CartaoKpi } from '@/components/painel/pecas'
import { moeda } from '@/lib/utils'
import { listarSaldos, metricasEstoque, metricasEstoquePorTipo } from '@/modules/estoque/consultas'
import { TabelaSaldo } from './tabela-saldo'

export const metadata: Metadata = { title: 'Saldo em Estoque' }

function detalheMinimo(abaixoDoMinimo: number) {
  if (abaixoDoMinimo === 0) return 'nenhum abaixo do mínimo'
  return <span className="text-perigo">{abaixoDoMinimo} abaixo do mínimo</span>
}

export default async function PaginaSaldoEstoque() {
  const [linhas, metricas, porTipo] = await Promise.all([
    listarSaldos(),
    metricasEstoque(),
    metricasEstoquePorTipo(),
  ])

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Saldo em Estoque"
        descricao="Quanto tem de cada produto, ao custo médio de aquisição"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoKpi
          rotulo="Água em estoque"
          valor={porTipo.agua.quantidade.toLocaleString('pt-BR')}
          Icone={Droplet}
          tom={porTipo.agua.abaixoDoMinimo > 0 ? 'perigo' : 'cat-4'}
          detalhe={detalheMinimo(porTipo.agua.abaixoDoMinimo)}
        />
        <CartaoKpi
          rotulo="Vasilhame em estoque"
          valor={porTipo.vasilhame.quantidade.toLocaleString('pt-BR')}
          Icone={Boxes}
          tom={porTipo.vasilhame.abaixoDoMinimo > 0 ? 'perigo' : 'cat-3'}
          detalhe={detalheMinimo(porTipo.vasilhame.abaixoDoMinimo)}
        />
        <CartaoKpi
          rotulo="Gás em estoque"
          valor={porTipo.gas.quantidade.toLocaleString('pt-BR')}
          Icone={Flame}
          tom={porTipo.gas.abaixoDoMinimo > 0 ? 'perigo' : 'cat-1'}
          detalhe={detalheMinimo(porTipo.gas.abaixoDoMinimo)}
        />
        <CartaoKpi
          rotulo="Valor em estoque"
          valor={moeda(metricas.valorTotal)}
          Icone={Wallet}
          tom="cat-2"
        />
      </div>

      <TabelaSaldo linhas={linhas} />
    </div>
  )
}
