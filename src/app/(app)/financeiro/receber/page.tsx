import type { Metadata } from 'next'
import { AlertTriangle, CircleCheck, Clock, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { CONTAS_RECEBER, RESUMO } from '@/lib/demo'
import { moeda } from '@/lib/utils'
import { TabelaReceber } from './tabela-receber'

export const metadata: Metadata = { title: 'Contas a Receber' }

export default function PaginaReceber() {
  // Os quatro somam por PARCELA, não por valor total do título — é o que
  // entra no caixa e é o mesmo número que o painel mostra. Somar o total de um
  // título parcelado infla o "a receber" em até três vezes.
  const cartoes = [
    {
      rotulo: 'Total lançado',
      valor: moeda(RESUMO.recebido + RESUMO.aReceber),
      detalhe: `${CONTAS_RECEBER.length} títulos`,
      Icone: Wallet,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Recebido',
      valor: moeda(RESUMO.recebido),
      detalhe: `${CONTAS_RECEBER.filter((c) => c.situacao === 'Recebido').length} títulos`,
      Icone: CircleCheck,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Em aberto',
      valor: moeda(RESUMO.emAberto),
      detalhe: `${RESUMO.venceEm7} vencem em 7 dias`,
      Icone: Clock,
      tom: 'alerta' as const,
    },
    {
      rotulo: 'Vencido',
      valor: moeda(RESUMO.vencido),
      detalhe: `${RESUMO.vencidoQtd} títulos`,
      Icone: AlertTriangle,
      tom: 'perigo' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Contas a Receber"
        descricao="Títulos por cliente, com situação e forma de pagamento"
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

      <TabelaReceber />
    </div>
  )
}
