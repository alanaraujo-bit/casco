import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { dataNaLoja } from '@/lib/formatos'
import { moeda } from '@/lib/utils'
import { pagarConta } from '@/modules/financeiro/acoes'
import {
  acharContaPagar,
  listarContas,
  listarFormasPagamento,
} from '@/modules/financeiro/consultas'
import { FormularioQuitar } from './formulario-quitar'

export const metadata: Metadata = { title: 'Pagar conta' }

export default async function PaginaPagarConta({ params }: PageProps<'/financeiro/pagar/[id]'>) {
  const { id } = await params

  const [conta, contas, formas] = await Promise.all([
    acharContaPagar(id),
    listarContas(),
    listarFormasPagamento(),
  ])

  // A RLS já garante que uma conta de outra distribuidora não é encontrada — o
  // 404 é o mesmo caminho para "não existe" e "não é sua".
  if (!conta) notFound()

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Pagar conta"
        descricao={`${conta.descricao}${conta.fornecedor ? ` · ${conta.fornecedor}` : ''} · parcela ${conta.parcela}`}
      />

      <Card className="p-4 md:p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-5">
          {[
            ['Código', conta.codigo ? String(conta.codigo).padStart(4, '0') : '—'],
            ['Emissão', conta.emissao],
            ['Vencimento', conta.vencimento],
            ['Valor previsto', moeda(Number(conta.valorPrevisto))],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs text-texto-suave">{rotulo}</dt>
              <dd className="font-medium tabular-nums text-texto">{valor}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-texto-suave">Despesa/Custos</dt>
            <dd className="mt-0.5">
              <Badge variant={conta.natureza === 'custo' ? 'info' : 'neutro'}>
                {conta.natureza === 'custo' ? 'Custo' : 'Despesa'}
              </Badge>
            </dd>
          </div>
        </dl>
        {conta.observacao && (
          <p className="mt-3 border-t border-borda pt-3 text-sm text-texto-suave">
            {conta.observacao}
          </p>
        )}
      </Card>

      <FormularioQuitar
        acao={pagarConta}
        conta={conta}
        contas={contas}
        formas={formas}
        hoje={dataNaLoja()}
      />
    </div>
  )
}
