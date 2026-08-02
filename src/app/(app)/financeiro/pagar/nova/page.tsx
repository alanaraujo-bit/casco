import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { dataNaLoja } from '@/lib/formatos'
import { lancarContaPagar } from '@/modules/financeiro/acoes'
import {
  listarCategoriasPagar,
  listarFornecedoresAtivos,
} from '@/modules/financeiro/consultas'
import { FormularioPagar } from './formulario-pagar'

export const metadata: Metadata = { title: 'Lançar conta a pagar' }

export default async function PaginaNovaConta() {
  const [fornecedores, categorias] = await Promise.all([
    listarFornecedoresAtivos(),
    listarCategoriasPagar(),
  ])

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Lançar conta a pagar"
        descricao="Uma conta, ou várias parcelas — cada uma com seu vencimento"
      />
      {/* A data padrão sai do servidor, no fuso da loja: deixar o navegador
          decidir daria a data do aparelho, que pode estar em qualquer fuso. */}
      <FormularioPagar
        acao={lancarContaPagar}
        fornecedores={fornecedores}
        hoje={dataNaLoja()}
        categorias={categorias}
      />
    </div>
  )
}
