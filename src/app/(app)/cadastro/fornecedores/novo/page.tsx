import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { criarFornecedor } from '@/modules/fornecedores/acoes'
import { FormularioFornecedor } from '../formulario-fornecedor'

export const metadata: Metadata = { title: 'Novo fornecedor' }

export default async function PaginaNovoFornecedor() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Novo fornecedor"
        descricao="O código é gerado automaticamente ao salvar"
      />
      <FormularioFornecedor acao={criarFornecedor} />
    </div>
  )
}
