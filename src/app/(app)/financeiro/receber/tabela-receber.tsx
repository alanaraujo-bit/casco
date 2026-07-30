'use client'

import { Badge } from '@/components/ui/badge'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { CONTAS_RECEBER, type ContaDemo } from '@/lib/demo'
import { moeda } from '@/lib/utils'

const TOM_SITUACAO = {
  Recebido: 'sucesso',
  'Em aberto': 'alerta',
  Vencido: 'perigo',
} as const

/** dd/mm/aaaa ordena por dia se comparado como texto. Vira Date. */
function data(br: string) {
  const [d, m, a] = br.split('/')
  return new Date(Number(a), Number(m) - 1, Number(d))
}

/**
 * A ordem das colunas é a do Fature Gestão, item por item.
 *
 * Não é preguiça: a operadora confere 111 lançamentos por mês varrendo com o
 * olho sempre nas mesmas posições. Reorganizar "melhor" custaria semanas de
 * lentidão dela para ganhar uma discussão de layout que ninguém pediu.
 *
 * As colunas de conferência (Banco, Forma, Data e Valor pago) nascem
 * escondidas e ligam num clique — a tela abre respirando, e quem precisa
 * conferir liga o que precisa.
 */
const colunas: Coluna<ContaDemo>[] = [
  { chave: 'origem', cabecalho: 'Origem', texto: (c) => c.origem, papelMobile: 'oculto' },
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (c) => c.codigo,
    valor: (c) => Number(c.codigo),
    numerica: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'cliente',
    cabecalho: 'Cliente / Descrição',
    texto: (c) => c.cliente,
    fixa: true,
    larguraMin: '14rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'emissao',
    cabecalho: 'Emissão',
    texto: (c) => c.emissao,
    valor: (c) => data(c.emissao),
    ocultaPorPadrao: true,
  },
  {
    chave: 'valorTotal',
    cabecalho: 'Valor Total',
    texto: (c) => moeda(c.valorTotal),
    valor: (c) => c.valorTotal,
    numerica: true,
    papelMobile: 'campo',
  },
  { chave: 'parcela', cabecalho: 'Parcela', texto: (c) => c.parcela, ordenavel: false },
  {
    // Estava faltando, e não é detalhe: num título de R$ 3.400 em "2/3", é este
    // o número que entra no caixa. Sem ele a operadora não fecha o dia.
    chave: 'valorParcela',
    cabecalho: 'Valor Parcela',
    texto: (c) => moeda(c.valorParcela),
    valor: (c) => c.valorParcela,
    numerica: true,
    papelMobile: 'destaque',
  },
  {
    chave: 'vencimento',
    cabecalho: 'Vencimento',
    texto: (c) => c.vencimento,
    valor: (c) => data(c.vencimento),
  },
  {
    chave: 'situacao',
    cabecalho: 'Situação',
    texto: (c) => c.situacao,
    celula: (c) => <Badge variant={TOM_SITUACAO[c.situacao]}>{c.situacao}</Badge>,
  },
  {
    chave: 'banco',
    cabecalho: 'Banco',
    texto: (c) => c.banco,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'formaPagamento',
    cabecalho: 'Forma Pgto',
    texto: (c) => c.formaPagamento,
    papelMobile: 'campo',
  },
  {
    chave: 'taxas',
    cabecalho: 'Taxas',
    texto: (c) => (c.taxas ? moeda(c.taxas) : '—'),
    valor: (c) => c.taxas || null,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'dataPagamento',
    cabecalho: 'Data Pagamento',
    texto: (c) => c.dataPagamento ?? '—',
    valor: (c) => (c.dataPagamento ? data(c.dataPagamento) : null),
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'valorPago',
    cabecalho: 'Valor Pago',
    texto: (c) => (c.valorPago == null ? '—' : moeda(c.valorPago)),
    valor: (c) => c.valorPago ?? null,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaReceber() {
  return (
    <TabelaDados
      id="contas-receber"
      legenda="Contas a receber"
      colunas={colunas}
      linhas={CONTAS_RECEBER}
      chaveLinha={(c) => c.id}
      buscaPlaceholder="Buscar por cliente, código, situação…"
      nomeExportacao="contas-a-receber"
      densidadePadrao="compacta"
      vazio={{ descricao: 'Nenhum título lançado neste período.' }}
    />
  )
}
