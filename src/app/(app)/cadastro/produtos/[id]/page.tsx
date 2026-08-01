import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { atualizarProduto } from '@/modules/produtos/acoes'
import { acharProduto, listarProdutosRetornaveis } from '@/modules/produtos/consultas'
import { FormularioProduto } from '../formulario-produto'
import { BotaoAtivo } from './botao-ativo'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const produto = await acharProduto(id)
  return { title: produto ? produto.nome : 'Produto não encontrado' }
}

export default async function PaginaEditarProduto({ params }: Props) {
  const { id } = await params

  const [produto, produtosVasilhame] = await Promise.all([
    acharProduto(id),
    listarProdutosRetornaveis(),
  ])

  if (!produto) notFound()

  const salvar = atualizarProduto.bind(null, produto.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo={produto.nome}
        descricao={
          produto.codigo
            ? `Produto ${String(produto.codigo).padStart(4, '0')}`
            : 'Cadastro de produto'
        }
        acoes={<BotaoAtivo id={produto.id} ativo={produto.ativo} />}
      />
      <FormularioProduto acao={salvar} produto={produto} produtosVasilhame={produtosVasilhame} />
    </div>
  )
}
