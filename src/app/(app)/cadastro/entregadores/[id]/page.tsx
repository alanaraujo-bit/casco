import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { atualizarEntregador } from '@/modules/entregadores/acoes'
import { acharEntregador } from '@/modules/entregadores/consultas'
import { FormularioEntregador } from '../formulario-entregador'
import { BotaoAtivo } from './botao-ativo'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const entregador = await acharEntregador(id)
  return { title: entregador ? entregador.nome : 'Entregador não encontrado' }
}

export default async function PaginaEditarEntregador({ params }: Props) {
  const { id } = await params
  const entregador = await acharEntregador(id)

  if (!entregador) notFound()

  const salvar = atualizarEntregador.bind(null, entregador.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo={entregador.nome}
        descricao={
          entregador.codigo
            ? `Entregador ${String(entregador.codigo).padStart(4, '0')}`
            : 'Cadastro de entregador'
        }
        acoes={<BotaoAtivo id={entregador.id} ativo={entregador.ativo} />}
      />
      <FormularioEntregador acao={salvar} entregador={entregador} />
    </div>
  )
}
