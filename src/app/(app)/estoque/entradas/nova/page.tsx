import type { Metadata } from 'next'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { dataNaLoja } from '@/lib/formatos'
import { lancarMovimento } from '@/modules/estoque/acoes'
import { listarProdutosParaMovimento } from '@/modules/estoque/consultas'
import { listarFornecedoresAtivos } from '@/modules/financeiro/consultas'
import { FormularioEntrada } from './formulario-entrada'

export const metadata: Metadata = { title: 'Novo movimento de estoque' }

export default async function PaginaNovoMovimento() {
  const [produtos, fornecedores] = await Promise.all([
    listarProdutosParaMovimento(),
    listarFornecedoresAtivos(),
  ])

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Novo movimento"
        descricao="Produção, compra, ajuste de inventário, perda e devolução"
      />
      {/* O vencimento sugerido sai do servidor, no fuso da loja: deixar o
          navegador calcular daria a data do aparelho — e, perto da meia-noite,
          um valor no servidor e outro no cliente, que é como o React derruba a
          hidratação da tela. Mesma razão do `hoje` em Contas a Pagar. */}
      <FormularioEntrada
        acao={lancarMovimento}
        produtos={produtos}
        fornecedores={fornecedores}
        vencimentoSugerido={dataNaLoja(30)}
      />
    </div>
  )
}
