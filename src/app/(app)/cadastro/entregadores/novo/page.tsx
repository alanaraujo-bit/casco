import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { criarEntregador } from '@/modules/entregadores/acoes'
import { FormularioEntregador } from '../formulario-entregador'

export const metadata: Metadata = { title: 'Novo entregador' }

export default async function PaginaNovoEntregador() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Novo entregador"
        descricao="O código é gerado automaticamente ao salvar"
      />
      <FormularioEntregador acao={criarEntregador} />
    </div>
  )
}
