import type { Metadata } from 'next'
import { AlertTriangle, CircleCheck, Clock, Plus, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CONTAS_RECEBER } from '@/lib/demo'
import { moeda } from '@/lib/utils'
import { TabelaReceber } from './tabela-receber'

export const metadata: Metadata = { title: 'Contas a Receber' }

export default function PaginaReceber() {
  const soma = (f: (c: (typeof CONTAS_RECEBER)[number]) => boolean) =>
    CONTAS_RECEBER.filter(f).reduce((s, c) => s + c.valorTotal, 0)

  const cartoes = [
    {
      rotulo: 'Total lançado',
      valor: moeda(soma(() => true)),
      Icone: Wallet,
      tom: 'acento' as const,
    },
    {
      rotulo: 'Recebido',
      valor: moeda(soma((c) => c.situacao === 'Recebido')),
      Icone: CircleCheck,
      tom: 'sucesso' as const,
    },
    {
      rotulo: 'Em aberto',
      valor: moeda(soma((c) => c.situacao === 'Em aberto')),
      Icone: Clock,
      tom: 'alerta' as const,
    },
    {
      rotulo: 'Vencido',
      valor: moeda(soma((c) => c.situacao === 'Vencido')),
      Icone: AlertTriangle,
      tom: 'perigo' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Contas a Receber"
        descricao="Títulos por cliente, com situação e forma de pagamento"
        acoes={
          <Button variant="primario" size="sm">
            <Plus aria-hidden />
            Novo lançamento
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
            </div>
          </Card>
        ))}
      </div>

      <TabelaReceber />
    </div>
  )
}
