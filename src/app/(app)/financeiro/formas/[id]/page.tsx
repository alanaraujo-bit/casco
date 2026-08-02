import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { salvarForma } from '@/modules/financeiro/acoes'
import { acharForma, listarContas } from '@/modules/financeiro/consultas'
import { FormularioForma } from '../../contas/formulario-forma'

export const metadata: Metadata = { title: 'Editar forma de pagamento' }

export default async function PaginaEditarForma({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [forma, contas] = await Promise.all([acharForma(id), listarContas()])
  if (!forma) notFound()

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Editar forma de pagamento"
        descricao={forma.nome}
        acoes={!forma.ativo ? <Badge variant="perigo">desativada</Badge> : undefined}
      />
      <FormularioForma
        acao={salvarForma}
        contas={contas}
        id={forma.id}
        inicial={{
          nome: forma.nome,
          tipo: forma.tipo,
          // A taxa é `numeric(6,4)` no banco e volta como "1.4900". Duas casas
          // é como ela é falada e digitada — "um e quarenta e nove por cento".
          taxaPercentual: Number(forma.taxaPercentual).toFixed(2).replace('.', ','),
          prazoDias: forma.prazoDias,
          contaId: forma.contaId,
        }}
      />
    </div>
  )
}
