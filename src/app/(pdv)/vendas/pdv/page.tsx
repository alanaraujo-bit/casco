import type { Metadata } from 'next'
import { exigirSessao } from '@/lib/dal'
import { abrirCaixa } from '@/modules/financeiro/acoes'
import { caixaAbertoHoje, listarContasCaixa, listarFormasPagamento } from '@/modules/financeiro/consultas'
import { fecharVenda } from '@/modules/vendas/acoes'
import {
  acharTabelaPadrao,
  listarClientesParaVenda,
  listarEntregadoresParaVenda,
  listarPrecosDeVenda,
  listarProdutosParaVenda,
} from '@/modules/vendas/consultas'
import { PdvKiosk } from './pdv-kiosk'

export const metadata: Metadata = { title: 'PDV' }

export default async function PaginaPdv() {
  // Em paralelo, e não em sequência: consultas independentes, e encadeá-las
  // somaria todos os tempos de ida e volta ao Railway na abertura da tela que
  // a operadora abre primeiro no turno.
  const [sessao, produtos, precos, clientes, entregadores, formas, tabelaPadraoId, caixa, contasCaixa] =
    await Promise.all([
      exigirSessao(),
      listarProdutosParaVenda(),
      listarPrecosDeVenda(),
      listarClientesParaVenda(),
      listarEntregadoresParaVenda(),
      listarFormasPagamento(),
      acharTabelaPadrao(),
      caixaAbertoHoje(),
      listarContasCaixa(),
    ])

  return (
    <PdvKiosk
      usuario={{ nome: sessao.nome, empresa: sessao.empresa }}
      caixaInicial={caixa}
      contasCaixa={contasCaixa}
      acaoAbrirCaixa={abrirCaixa}
      acaoFecharVenda={fecharVenda}
      produtos={produtos}
      precos={precos}
      clientes={clientes}
      entregadores={entregadores}
      formas={formas}
      tabelaPadraoId={tabelaPadraoId}
      companyId={sessao.companyId}
    />
  )
}
