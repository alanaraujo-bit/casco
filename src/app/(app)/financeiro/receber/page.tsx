import type { Metadata } from 'next'
import { AlertTriangle, CircleCheck, Wallet } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { NavegadorPeriodo } from '@/components/financeiro/navegador-periodo'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { listarContasReceber, metricasReceber } from '@/modules/financeiro/consultas'
import type { Mes } from '@/modules/relatorios/periodo'
import { moeda } from '@/lib/utils'
import { TabelaReceber } from './tabela-receber'

export const metadata: Metadata = { title: 'Contas a Receber' }

/** `?mes=` ausente ou fora do formato é "todo o período" — nunca um erro. */
function mesDaQuery(valor: string | undefined): Mes | undefined {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : undefined
}

export default async function PaginaReceber({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const mes = mesDaQuery((await searchParams).mes)
  const [linhas, m] = await Promise.all([listarContasReceber(mes), metricasReceber(mes)])

  // Os três somam por PARCELA, não por valor total do título — é o que entra
  // no caixa. Somar o total de um título parcelado infla "a receber" em até
  // três vezes, e o dono soma de cabeça: ele acha esse erro em trinta segundos.
  const cartoes = [
    {
      rotulo: 'A Vencer',
      valor: moeda(Number(m.aVencer)),
      detalhe: `${m.qtdAVencer} ${m.qtdAVencer === 1 ? 'título' : 'títulos'}`,
      Icone: Wallet,
      tom: 'alerta' as const,
    },
    {
      rotulo: 'Vencido',
      valor: moeda(Number(m.vencido)),
      detalhe: `${m.qtdVencido} ${m.qtdVencido === 1 ? 'título' : 'títulos'}`,
      Icone: AlertTriangle,
      // Vermelho só quando há vencido de verdade. Cartão em alarme permanente
      // com R$ 0,00 ensina a operadora a ignorar a cor em uma semana — e aí ele
      // não serve mais para o dia em que houver.
      tom: m.qtdVencido > 0 ? ('perigo' as const) : ('cat-2' as const),
    },
    {
      rotulo: 'Recebido',
      valor: moeda(Number(m.recebido)),
      detalhe: `${m.qtdRecebido} ${m.qtdRecebido === 1 ? 'título' : 'títulos'}`,
      Icone: CircleCheck,
      tom: 'sucesso' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Contas a Receber"
        descricao="Títulos por cliente, com situação e forma de pagamento"
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

      <NavegadorPeriodo mes={mes} base="/financeiro/receber" />

      <TabelaReceber linhas={linhas} />
    </div>
  )
}
