import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { atualizarFornecedor } from '@/modules/fornecedores/acoes'
import { acharFornecedor } from '@/modules/fornecedores/consultas'
import { FormularioFornecedor } from '../formulario-fornecedor'
import { BotaoAtivo } from './botao-ativo'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const fornecedor = await acharFornecedor(id)
  return { title: fornecedor ? fornecedor.nome : 'Fornecedor não encontrado' }
}

export default async function PaginaEditarFornecedor({ params }: Props) {
  const { id } = await params
  const fornecedor = await acharFornecedor(id)

  if (!fornecedor) notFound()

  const salvar = atualizarFornecedor.bind(null, fornecedor.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo={fornecedor.nome}
        descricao={
          fornecedor.codigo
            ? `Fornecedor ${String(fornecedor.codigo).padStart(4, '0')}`
            : 'Cadastro de fornecedor'
        }
        acoes={<BotaoAtivo id={fornecedor.id} ativo={fornecedor.ativo} />}
      />
      <FormularioFornecedor acao={salvar} fornecedor={fornecedor} />
    </div>
  )
}
