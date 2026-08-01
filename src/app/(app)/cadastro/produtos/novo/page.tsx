import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { criarProduto } from '@/modules/produtos/acoes'
import { listarProdutosRetornaveis } from '@/modules/produtos/consultas'
import { FormularioProduto } from '../formulario-produto'

export const metadata: Metadata = { title: 'Novo produto' }

export default async function PaginaNovoProduto() {
  const produtosVasilhame = await listarProdutosRetornaveis()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Novo produto"
        descricao="O código é gerado automaticamente ao salvar"
      />
      <FormularioProduto acao={criarProduto} produtosVasilhame={produtosVasilhame} />
    </div>
  )
}
