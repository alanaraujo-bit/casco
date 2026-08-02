import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { salvarForma } from '@/modules/financeiro/acoes'
import { listarContas } from '@/modules/financeiro/consultas'
import { FormularioForma } from '../../contas/formulario-forma'

export const metadata: Metadata = { title: 'Nova forma de pagamento' }

export default async function PaginaNovaForma() {
  // Só as contas ativas: apontar uma forma nova para uma conta desativada
  // criaria dinheiro sem destino, e o erro só apareceria na primeira venda.
  const contas = await listarContas()

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Nova forma de pagamento"
        descricao="Como o cliente paga, e quanto a maquininha desconta"
      />
      <FormularioForma acao={salvarForma} contas={contas} />
    </div>
  )
}
