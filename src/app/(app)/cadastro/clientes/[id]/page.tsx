import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { atualizarCliente } from '@/modules/clientes/acoes'
import { acharCliente, listarTabelasPreco } from '@/modules/clientes/consultas'
import { FormularioCliente } from '../formulario-cliente'
import { BotaoAtivo } from './botao-ativo'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const cliente = await acharCliente(id)
  return { title: cliente ? cliente.nome : 'Cliente não encontrado' }
}

export default async function PaginaEditarCliente({ params }: Props) {
  // `params` é assíncrono nesta versão do Next — acesso síncrono foi removido.
  const { id } = await params

  const [cliente, tabelas] = await Promise.all([acharCliente(id), listarTabelasPreco()])

  // Cliente de outra distribuidora cai aqui também: a RLS filtra a linha e a
  // consulta devolve `null`. Do lado de fora, "não existe" e "não é seu" são
  // indistinguíveis — que é exatamente como deve ser.
  if (!cliente) notFound()

  // A action recebe o id fechado no servidor, não por campo escondido no
  // formulário: campo escondido é editável pelo navegador, e editar o cliente
  // do vizinho viraria questão de trocar um valor no DevTools. A RLS ainda
  // barraria por empresa, mas dentro da mesma empresa não barraria nada.
  const salvar = atualizarCliente.bind(null, cliente.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo={cliente.nome}
        descricao={
          cliente.codigo
            ? `Cliente ${String(cliente.codigo).padStart(4, '0')}`
            : 'Cadastro de cliente'
        }
        acoes={<BotaoAtivo id={cliente.id} ativo={cliente.ativo} />}
      />
      <FormularioCliente acao={salvar} cliente={cliente} tabelas={tabelas} />
    </div>
  )
}
