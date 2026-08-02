'use client'

import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import type { TituloLista } from '@/modules/financeiro/consultas'
import { moeda } from '@/lib/utils'

const TOM_SITUACAO = {
  Recebido: 'sucesso',
  'Em aberto': 'alerta',
  Vencido: 'perigo',
} as const

/** dd/mm/aaaa ordena por dia se comparado como texto. Vira Date. */
function data(br: string | null) {
  if (!br) return null
  const [d, m, a] = br.split('/')
  return new Date(Number(a), Number(m) - 1, Number(d))
}

/**
 * `numeric` do Postgres chega como string, e de propósito: `12345678.99` em
 * `Number` já perde centavo. Convertemos só na hora de formatar, nunca para
 * fazer conta — soma de dinheiro é responsabilidade do banco.
 */
const num = (v: string | null) => (v == null ? null : Number(v))

/**
 * A ordem das colunas é a consagrada num contas a receber, item por item.
 *
 * Não é preguiça: a operadora confere mais de cem lançamentos por mês varrendo com o
 * olho sempre nas mesmas posições. Reorganizar "melhor" custaria semanas de
 * lentidão dela para ganhar uma discussão de layout que ninguém pediu.
 *
 * As colunas de conferência (Banco, Forma, Data e Valor pago) nascem
 * escondidas e ligam num clique — a tela abre respirando, e quem precisa
 * conferir liga o que precisa.
 */
const colunas: Coluna<TituloLista>[] = [
  { chave: 'origem', cabecalho: 'Origem', texto: (c) => c.origem, papelMobile: 'oculto' },
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (c) => (c.codigo ? String(c.codigo).padStart(4, '0') : '—'),
    valor: (c) => c.codigo ?? 0,
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
    texto: (c) => moeda(Number(c.valorTotal)),
    valor: (c) => Number(c.valorTotal),
    numerica: true,
    papelMobile: 'campo',
  },
  { chave: 'parcela', cabecalho: 'Parcela', texto: (c) => c.parcela, ordenavel: false },
  {
    // Num título de R$ 3.400 em "2/3", é este o número que entra no caixa.
    // Sem ele a operadora não fecha o dia.
    chave: 'valorParcela',
    cabecalho: 'Valor Parcela',
    texto: (c) => moeda(Number(c.valorParcela)),
    valor: (c) => Number(c.valorParcela),
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
    // Derivada no banco a partir de `pago_em` e `vencimento`, nunca digitada:
    // situação gravada é como se produz linha "Vencido" com vencimento no mês que vem.
    chave: 'situacao',
    cabecalho: 'Situação',
    texto: (c) => c.situacao,
    celula: (c) => <Badge variant={TOM_SITUACAO[c.situacao]}>{c.situacao}</Badge>,
  },
  {
    chave: 'banco',
    cabecalho: 'Banco',
    texto: (c) => c.banco ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'formaPagamento',
    cabecalho: 'Forma Pgto',
    texto: (c) => c.formaPagamento ?? '—',
    papelMobile: 'campo',
  },
  {
    chave: 'taxas',
    cabecalho: 'Taxas',
    texto: (c) => (Number(c.taxas) ? moeda(Number(c.taxas)) : '—'),
    valor: (c) => Number(c.taxas) || null,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'dataPagamento',
    cabecalho: 'Data Pagamento',
    texto: (c) => c.dataPagamento ?? '—',
    valor: (c) => data(c.dataPagamento),
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'valorPago',
    cabecalho: 'Valor Pago',
    texto: (c) => (c.valorPago == null ? '—' : moeda(Number(c.valorPago))),
    valor: (c) => num(c.valorPago),
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    // A coluna que faltava para a tela sair do papel de relatório. Sem ela, o
    // título gerado pelo PDV nasce e fica: dá para ver que o cliente deve, e
    // não dá para registrar que ele pagou.
    chave: 'acoes',
    cabecalho: 'Baixa',
    texto: (c) => (c.situacao === 'Recebido' ? 'Recebido' : 'Receber'),
    celula: (c) => (
      <Button
        asChild
        variant={c.situacao === 'Recebido' ? 'fantasma' : 'suave'}
        size="sm"
      >
        <Link href={`/financeiro/receber/${c.id}`}>
          {c.situacao === 'Recebido' ? (
            'Ver baixa'
          ) : (
            <>
              <Wallet aria-hidden />
              Receber
            </>
          )}
        </Link>
      </Button>
    ),
    ordenavel: false,
    alinhamento: 'direita',
    larguraMin: '8rem',
  },
]

export function TabelaReceber({ linhas }: { linhas: TituloLista[] }) {
  return (
    <TabelaDados
      id="contas-receber"
      legenda="Contas a receber"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(c) => c.id}
      buscaPlaceholder="Buscar por cliente, código, situação…"
      nomeExportacao="contas-a-receber"
      densidadePadrao="compacta"
      vazio={{
        titulo: 'Nenhum título lançado',
        descricao:
          'Os títulos aparecem aqui quando uma venda for registrada a prazo, ou quando você lançar uma cobrança avulsa.',
      }}
    />
  )
}
