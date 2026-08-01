import type { Metadata } from 'next'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Button } from '@/components/ui/button'
import { fecharVenda } from '@/modules/vendas/acoes'
import {
  acharTabelaPadrao,
  listarClientesParaVenda,
  listarFormasPagamento,
  listarPrecosDeVenda,
  listarProdutosParaVenda,
} from '@/modules/vendas/consultas'
import { Pdv } from './pdv'

export const metadata: Metadata = { title: 'PDV' }

export default async function PaginaPdv() {
  // Em paralelo, e não em sequência: são cinco consultas independentes, e
  // encadeá-las somaria os cinco tempos de ida e volta ao Railway na abertura
  // da tela que a operadora abre primeiro toda manhã.
  const [produtos, precos, clientes, formas, tabelaPadraoId] = await Promise.all([
    listarProdutosParaVenda(),
    listarPrecosDeVenda(),
    listarClientesParaVenda(),
    listarFormasPagamento(),
    acharTabelaPadrao(),
  ])

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="PDV"
        descricao="Venda de balcão — dinheiro, cartão ou fiado, com o vasilhame junto"
        acoes={
          <Button asChild variant="secundario">
            <Link href="/vendas/produtos">
              <Receipt aria-hidden />
              Ver vendas
            </Link>
          </Button>
        }
      />

      <Pdv
        acao={fecharVenda}
        produtos={produtos}
        precos={precos}
        clientes={clientes}
        formas={formas}
        tabelaPadraoId={tabelaPadraoId}
      />
    </div>
  )
}
