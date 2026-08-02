import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { salvarConta } from '@/modules/financeiro/acoes'
import { FormularioConta } from '../formulario-conta'

export const metadata: Metadata = { title: 'Nova conta bancária' }

export default function PaginaNovaConta() {
  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Nova conta bancária"
        descricao="Onde o dinheiro cai — a gaveta do balcão ou uma conta de verdade"
      />
      <FormularioConta acao={salvarConta} />
    </div>
  )
}
