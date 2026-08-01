import type { Metadata } from 'next'
import Link from 'next/link'
import { Truck, TrendingDown, Users } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { listarSaldos, maioresDevedores, metricasVasilhame } from '@/modules/vasilhame/consultas'
import { TabelaSaldos } from './tabela-saldos'

export const metadata: Metadata = { title: 'Saldo por Cliente' }

export default async function PaginaSaldos() {
  const [linhas, metricas, maiores] = await Promise.all([
    listarSaldos(),
    metricasVasilhame(),
    maioresDevedores(5),
  ])

  const cartoes = [
    {
      rotulo: 'Galões na rua',
      valor: metricas.naRua.toLocaleString('pt-BR'),
      Icone: Truck,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Clientes devendo',
      valor: metricas.clientesDevendo.toLocaleString('pt-BR'),
      Icone: Users,
      tom: 'cat-3' as const,
    },
    {
      rotulo: 'Devolvidos no mês',
      valor: metricas.devolvidosMes.toLocaleString('pt-BR'),
      Icone: Truck,
      tom: 'cat-4' as const,
    },
    {
      rotulo: 'Perdidos no mês',
      valor: metricas.perdaUnidades.toLocaleString('pt-BR'),
      Icone: TrendingDown,
      tom: metricas.perdaUnidades > 0 ? ('alerta' as const) : ('cat-2' as const),
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Saldo por Cliente"
        descricao="Quem está com vasilhame nosso, e quantos"
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

      {maiores.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-texto">Maiores saldos</h2>
          <ul className="flex flex-wrap gap-2">
            {maiores.map((d) => (
              <li key={d.clienteId}>
                {/* Atalho, não decoração: a cobrança de vasilhame começa por
                    quem mais tem, e chegar ao extrato dele em um toque é a
                    diferença entre a lista ser usada e ser só olhada. */}
                <Link
                  href={`/vasilhame/saldos/${d.clienteId}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-borda-controle bg-superficie px-3 text-sm text-texto transition-colors hover:bg-superficie-hover md:min-h-8"
                >
                  <span className="truncate">{d.cliente}</span>
                  <span className="font-semibold tabular-nums text-acento-texto">{d.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TabelaSaldos linhas={linhas} />
    </div>
  )
}
