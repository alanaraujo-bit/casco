import type { Metadata } from 'next'
import { Building2, IdCard, Phone, UserX } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { listarFornecedores, metricasFornecedores } from '@/modules/fornecedores/consultas'
import { TabelaFornecedores } from './tabela-fornecedores'

export const metadata: Metadata = { title: 'Fornecedores' }

export default async function PaginaFornecedores() {
  const [linhas, metricas] = await Promise.all([
    listarFornecedores(),
    metricasFornecedores(),
  ])

  const cartoes = [
    {
      rotulo: 'Total de fornecedores',
      valor: metricas.total.toLocaleString('pt-BR'),
      Icone: Building2,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Com CPF/CNPJ',
      valor: `${metricas.comDocumento} de ${metricas.total}`,
      Icone: IdCard,
      tom: 'cat-3' as const,
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
        titulo="Fornecedores"
        descricao="Cadastro de fornecedores para compras e contas a pagar"
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

      <TabelaFornecedores linhas={linhas} />
    </div>
  )
}
