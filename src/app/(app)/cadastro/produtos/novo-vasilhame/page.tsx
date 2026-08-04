import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { criarProduto } from '@/modules/produtos/acoes'
import { listarCategoriasProduto, listarProdutosRetornaveis } from '@/modules/produtos/consultas'
import { FormularioProduto } from '../formulario-produto'

export const metadata: Metadata = { title: 'Novo vasilhame' }

export default async function PaginaNovoVasilhame() {
  const [produtosVasilhame, categorias] = await Promise.all([
    listarProdutosRetornaveis(),
    listarCategoriasProduto(),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Novo vasilhame"
        descricao="O código é gerado automaticamente ao salvar"
      />
      <FormularioProduto
        acao={criarProduto}
        produtosVasilhame={produtosVasilhame}
        categorias={categorias}
        tipo="vasilhame"
      />
    </div>
  )
}
