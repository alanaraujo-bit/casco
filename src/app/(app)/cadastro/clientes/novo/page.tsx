import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { criarCliente } from '@/modules/clientes/acoes'
import { listarTabelasPreco } from '@/modules/clientes/consultas'
import { FormularioCliente } from '../formulario-cliente'

export const metadata: Metadata = { title: 'Novo cliente' }

export default async function PaginaNovoCliente() {
  const tabelas = await listarTabelasPreco()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Novo cliente"
        descricao="O código é gerado automaticamente ao salvar"
      />
      <FormularioCliente acao={criarCliente} tabelas={tabelas} />
    </div>
  )
}
