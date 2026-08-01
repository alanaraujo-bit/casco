import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { criarTabela } from '@/modules/tabelas-preco/acoes'
import { FormularioTabela } from '../formulario-tabela'

export const metadata: Metadata = { title: 'Nova tabela de preço' }

export default async function PaginaNovaTabela() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Nova tabela de preço"
        descricao="Defina o nome e se é a tabela padrão para novos clientes"
      />
      <FormularioTabela acao={criarTabela} />
    </div>
  )
}
