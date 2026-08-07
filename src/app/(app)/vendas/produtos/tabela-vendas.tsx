'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDataHora } from '@/lib/formatos'
import { moeda } from '@/lib/utils'
import type { VendaLista } from '@/modules/vendas/consultas'

/**
 * A listagem de vendas, na ordem de colunas consagrada:
 * Operação · Código · Data · Cliente · Entregador · Água · Vendedor · Comissão ·
 * Tipo Venda · Parcelas · Valor · Recebido · Taxas · A Receber.
 *
 * **Entregador e Água entram logo depois de Cliente**, e a posição é a decisão:
 * as três colunas respondem juntas a pergunta que a operadora faz olhando a
 * lista — quem comprou, quanto de água levou e quem foi levar. Jogadas para o
 * fim, depois de sete colunas de dinheiro, elas exigiriam rolagem horizontal
 * justamente no dado que ela veio conferir.
 *
 * Comissão e Vendedor nascem ocultas: a JM não tem vendedor comissionado hoje,
 * e coluna que mostra zero em toda linha só ocupa a largura que falta para as
 * colunas que importam. Ficam no seletor, prontas para o dia em que houver.
 */

const OPERACAO: Record<string, string> = {
  pdv: 'PDV',
  balcao: 'Balcão',
  entrega: 'Entrega',
  whatsapp: 'WhatsApp',
}

const colunas: Coluna<VendaLista>[] = [
  {
    chave: 'operacao',
    cabecalho: 'Operação',
    texto: (v) => OPERACAO[v.operacao] ?? v.operacao,
    celula: (v) => <Badge variant="neutro">{OPERACAO[v.operacao] ?? v.operacao}</Badge>,
    larguraMin: '7rem',
  },
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (v) => (v.codigo ? String(v.codigo).padStart(4, '0') : '—'),
    valor: (v) => v.codigo ?? 0,
    numerica: true,
    fixa: true,
    larguraMin: '6rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'criadoEm',
    cabecalho: 'Data',
    texto: (v) => formatarDataHora(v.criadoEm),
    valor: (v) => new Date(v.criadoEm),
    larguraMin: '9rem',
    papelMobile: 'campo',
  },
  {
    chave: 'cliente',
    cabecalho: 'Cliente',
    texto: (v) => v.cliente,
    larguraMin: '14rem',
  },
  {
    chave: 'entregador',
    cabecalho: 'Entregador',
    // Venda sem entregador não é dado faltando — muita venda é levada pelo
    // próprio cliente no balcão. Mas "—" some no meio da tabela, e quem quer
    // marcar depois precisa achar as linhas. O selo dá a elas um contorno.
    texto: (v) => v.entregador ?? 'Não marcado',
    celula: (v) =>
      v.entregador ?? <span className="text-texto-fraco">Não marcado</span>,
    larguraMin: '11rem',
    papelMobile: 'campo',
  },
  {
    chave: 'agua',
    cabecalho: 'Água',
    // A unidade fica na célula e não no cabeçalho: "Água (gal)" espreme a
    // coluna, e um número solto sob "Água" não diz de que se está falando.
    texto: (v) => (v.agua > 0 ? `${v.agua.toLocaleString('pt-BR')} gal` : '—'),
    valor: (v) => v.agua,
    numerica: true,
    celula: (v) =>
      v.agua > 0 ? (
        <span className="tabular-nums text-texto">
          {v.agua.toLocaleString('pt-BR')}
          <span className="ml-1 text-2xs text-texto-fraco">gal</span>
        </span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
    larguraMin: '6.5rem',
    papelMobile: 'campo',
  },
  {
    chave: 'devolvido',
    cabecalho: 'Vasilhame recolhido',
    texto: (v) => (v.devolvido > 0 ? String(v.devolvido) : '—'),
    valor: (v) => v.devolvido,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'vendedor',
    cabecalho: 'Vendedor',
    texto: (v) => v.vendedor ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'comissao',
    cabecalho: 'Comissão',
    texto: (v) => moeda(Number(v.comissao)),
    valor: (v) => Number(v.comissao),
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'tipoVenda',
    cabecalho: 'Tipo Venda',
    texto: (v) => v.tipoVenda,
    larguraMin: '9rem',
  },
  {
    chave: 'parcelas',
    cabecalho: 'Parcelas',
    texto: (v) => String(v.parcelas),
    valor: (v) => v.parcelas,
    numerica: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'valor',
    cabecalho: 'Valor',
    texto: (v) => moeda(Number(v.valor)),
    valor: (v) => Number(v.valor),
    numerica: true,
    celula: (v) => (
      <span className="font-medium tabular-nums text-texto">{moeda(Number(v.valor))}</span>
    ),
    papelMobile: 'destaque',
  },
  {
    chave: 'recebido',
    cabecalho: 'Recebido',
    texto: (v) => moeda(Number(v.recebido)),
    valor: (v) => Number(v.recebido),
    numerica: true,
    celula: (v) =>
      Number(v.recebido) > 0 ? (
        <span className="tabular-nums text-sucesso">{moeda(Number(v.recebido))}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
  {
    chave: 'taxas',
    cabecalho: 'Taxas',
    texto: (v) => (Number(v.taxas) > 0 ? moeda(Number(v.taxas)) : '—'),
    valor: (v) => Number(v.taxas),
    numerica: true,
    celula: (v) =>
      // A diferença entre o que a venda diz e o que o extrato do banco vai
      // mostrar no fim do mês.
      Number(v.taxas) > 0 ? (
        <span className="tabular-nums text-alerta">{moeda(Number(v.taxas))}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
  {
    chave: 'aReceber',
    cabecalho: 'A Receber',
    texto: (v) => (Number(v.aReceber) > 0 ? moeda(Number(v.aReceber)) : '—'),
    valor: (v) => Number(v.aReceber),
    numerica: true,
    celula: (v) =>
      Number(v.aReceber) > 0 ? (
        <span className="tabular-nums text-alerta">{moeda(Number(v.aReceber))}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
  {
    chave: 'itens',
    cabecalho: 'Itens',
    texto: (v) => String(v.itens),
    valor: (v) => v.itens,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaVendas({ linhas }: { linhas: VendaLista[] }) {
  return (
    <TabelaDados
      id="vendas-listagem"
      legenda="Vendas de produtos"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(v) => v.id}
      // A linha inteira abre a venda — a âncora de verdade mora na coluna
      // "Código", que é a marcada como título. Ver `TabelaDados`.
      linkDaLinha={(v) => `/vendas/produtos/${v.id}`}
      buscaPlaceholder="Buscar por cliente, entregador, código ou forma de pagamento…"
      nomeExportacao="vendas"
      densidadePadrao="compacta"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/vendas/pdv">
            <ShoppingCart aria-hidden />
            Nova venda
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhuma venda registrada',
        descricao:
          'Cada venda fechada no PDV aparece aqui — com o que entrou no caixa, o que ficou a receber e quanto a maquininha levou.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/vendas/pdv">
              <ShoppingCart aria-hidden />
              Abrir o PDV
            </Link>
          </Button>
        ),
      }}
    />
  )
}
