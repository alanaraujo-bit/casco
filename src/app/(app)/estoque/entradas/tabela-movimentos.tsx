'use client'

import Link from 'next/link'
import { PackagePlus, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDataHora } from '@/lib/formatos'
import { moeda, quantidade as fmtQtd } from '@/lib/utils'
import { REGRA } from '@/modules/estoque/esquema'
import type { MovimentoLista } from '@/modules/estoque/consultas'
import { BotaoEstornar } from './botao-estornar'

/**
 * O razão completo do estoque.
 *
 * A linha não é clicável de propósito, ao contrário das outras listagens: esta
 * tela tem uma ação destrutiva na última coluna, e "clicar na linha navega"
 * junto de "clicar no botão estorna" é como se estorna sem querer. Quem quer o
 * extrato do produto clica no nome dele, que é um link explícito.
 */
const colunas: Coluna<MovimentoLista>[] = [
  {
    chave: 'criadoEm',
    cabecalho: 'Data',
    texto: (m) => formatarDataHora(m.criadoEm),
    valor: (m) => new Date(m.criadoEm),
    larguraMin: '9rem',
    papelMobile: 'campo',
  },
  {
    chave: 'tipo',
    cabecalho: 'Tipo',
    texto: (m) => REGRA[m.tipo].rotulo,
    celula: (m) => (
      <span className="flex items-center gap-1.5">
        <Badge variant={REGRA[m.tipo].tom}>{REGRA[m.tipo].rotulo}</Badge>
        {m.estornoDe && (
          <Badge variant="neutro" className="shrink-0">
            <Undo2 className="size-3" aria-hidden />
            estorno
          </Badge>
        )}
      </span>
    ),
    fixa: true,
    larguraMin: '11rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'produto',
    cabecalho: 'Produto',
    texto: (m) => m.produto,
    celula: (m) => (
      <Link
        href={`/estoque/saldo/${m.produtoId}`}
        className="underline-offset-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {m.produto}
      </Link>
    ),
    larguraMin: '13rem',
  },
  {
    chave: 'quantidade',
    cabecalho: 'Quantidade',
    // O sinal aparece aqui e em nenhum campo de digitação: no extrato ele é
    // informação, no formulário seria uma forma de inverter um saldo sem querer.
    texto: (m) => `${m.quantidade > 0 ? '+' : '−'}${fmtQtd(Math.abs(m.quantidade))}`,
    valor: (m) => m.quantidade,
    numerica: true,
    larguraMin: '8rem',
    papelMobile: 'destaque',
    celula: (m) => (
      <span className={m.quantidade > 0 ? 'text-sucesso' : 'text-texto'}>
        {m.quantidade > 0 ? '+' : '−'}
        {fmtQtd(Math.abs(m.quantidade))}
      </span>
    ),
  },
  {
    chave: 'custoUnitario',
    cabecalho: 'Custo Unit.',
    texto: (m) => moeda(m.custoUnitario),
    valor: (m) => m.custoUnitario,
    numerica: true,
    larguraMin: '7rem',
  },
  {
    chave: 'valor',
    cabecalho: 'Valor',
    texto: (m) => moeda(m.valor),
    valor: (m) => m.valor,
    numerica: true,
    larguraMin: '7rem',
  },
  {
    chave: 'fornecedor',
    cabecalho: 'Fornecedor',
    // Vazio aqui não é dado faltando — é movimento interno, e a tabela precisa
    // dizer isso em vez de mostrar um traço que parece cadastro incompleto.
    texto: (m) => m.fornecedor ?? 'Interno',
    celula: (m) =>
      m.fornecedor ? m.fornecedor : <span className="text-texto-fraco">Interno</span>,
    larguraMin: '11rem',
  },
  {
    chave: 'documento',
    cabecalho: 'Nota',
    texto: (m) => m.documento || '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'observacao',
    cabecalho: 'Observação',
    texto: (m) => m.observacao || '—',
    celula: (m) =>
      m.observacao ? (
        <span className="block max-w-[28rem] truncate" title={m.observacao}>
          {m.observacao}
        </span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'usuario',
    cabecalho: 'Usuário',
    texto: (m) => m.usuario || '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'acoes',
    cabecalho: 'Ações',
    texto: () => '',
    // O estorno da baixa de venda não é oferecido: desfazer uma venda é
    // cancelar a venda, e não devolver a mercadoria ao estoque por fora — isso
    // deixaria o faturamento afirmando uma coisa e o estoque outra.
    celula: (m) =>
      m.estornoDe || !REGRA[m.tipo].lancavelNaMao ? (
        <span className="text-xs text-texto-fraco">—</span>
      ) : (
        <BotaoEstornar id={m.id} estornado={m.estornado} />
      ),
    ordenavel: false,
    alinhamento: 'direita',
    larguraMin: '10rem',
  },
]

export function TabelaMovimentos({ linhas }: { linhas: MovimentoLista[] }) {
  return (
    <TabelaDados
      id="estoque-movimentos"
      legenda="Movimentos de estoque"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(m) => m.id}
      buscaPlaceholder="Buscar por produto, fornecedor, nota…"
      nomeExportacao="movimentos-estoque"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/estoque/entradas/nova">
            <PackagePlus aria-hidden />
            Novo movimento
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum movimento lançado',
        descricao:
          'Toda entrada e saída de mercadoria aparece aqui — produção, compra, ajuste, perda e a baixa automática das vendas.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/estoque/entradas/nova">
              <PackagePlus aria-hidden />
              Lançar primeiro movimento
            </Link>
          </Button>
        ),
      }}
    />
  )
}
