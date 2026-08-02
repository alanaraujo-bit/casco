import type { Metadata } from 'next'
import { AlertTriangle, CircleCheck, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { NavegadorPeriodo } from '@/components/financeiro/navegador-periodo'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { moeda } from '@/lib/utils'
import type { Mes } from '@/modules/relatorios/periodo'
import { listarContasPagar, metricasPagar } from '@/modules/financeiro/consultas'
import { TabelaPagar } from './tabela-pagar'

export const metadata: Metadata = { title: 'Contas a Pagar' }

/** `?mes=` ausente ou fora do formato é "todo o período" — nunca um erro. */
function mesDaQuery(valor: string | undefined): Mes | undefined {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : undefined
}

export default async function PaginaPagar({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const mes = mesDaQuery((await searchParams).mes)
  const [linhas, m] = await Promise.all([listarContasPagar(mes), metricasPagar(mes)])

  const cartoes = [
    {
      rotulo: 'A Vencer',
      valor: moeda(Number(m.aVencer)),
      detalhe: `${m.qtdAVencer} ${m.qtdAVencer === 1 ? 'conta' : 'contas'}`,
      Icone: Wallet,
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
      rotulo: 'Pago',
      valor: moeda(Number(m.pago)),
      detalhe: `${m.qtdPago} ${m.qtdPago === 1 ? 'conta' : 'contas'}`,
      Icone: CircleCheck,
      tom: 'info' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Contas a Pagar"
        descricao="O que a distribuidora deve, separado entre custo e despesa"
      />

      <div className="grid gap-3 sm:grid-cols-3">
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

      <NavegadorPeriodo mes={mes} base="/financeiro/pagar" />

      <TabelaPagar linhas={linhas} />
    </div>
  )
}
