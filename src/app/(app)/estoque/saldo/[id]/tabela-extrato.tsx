'use client'

import { Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDataHora } from '@/lib/formatos'
import { cn, moeda, quantidade as fmtQtd } from '@/lib/utils'
import { REGRA } from '@/modules/estoque/esquema'
import type { LinhaExtrato } from '@/modules/estoque/consultas'

/**
 * O extrato auditável de um produto.
 *
 * A coluna que justifica a tela é `saldoApos`: ela permite descer o histórico
 * até achar o lançamento a partir do qual a conta parou de bater. Sem ela o
 * extrato é uma lista de eventos, e responder "de onde saiu esse 143?" vira
 * soma no papel.
 *
 * Linha estornada aparece riscada em vez de sumir — o que foi corrigido é parte
 * da explicação do saldo, e escondê-la é como o histórico deixa de justificar
 * o número que ele deveria justificar.
 */
const colunas: Coluna<LinhaExtrato>[] = [
  {
    chave: 'criadoEm',
    cabecalho: 'Data',
    texto: (l) => formatarDataHora(l.criadoEm),
    valor: (l) => new Date(l.criadoEm),
    larguraMin: '9rem',
    papelMobile: 'campo',
  },
  {
    chave: 'tipo',
    cabecalho: 'Tipo',
    texto: (l) => REGRA[l.tipo].rotulo,
    celula: (l) => (
      <span className="flex items-center gap-1.5">
        <Badge variant={REGRA[l.tipo].tom}>{REGRA[l.tipo].rotulo}</Badge>
        {l.estornoDe && (
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
    chave: 'quantidade',
    cabecalho: 'Quantidade',
    texto: (l) => `${l.quantidade > 0 ? '+' : '−'}${fmtQtd(Math.abs(l.quantidade))}`,
    valor: (l) => l.quantidade,
    numerica: true,
    larguraMin: '8rem',
    papelMobile: 'destaque',
    celula: (l) => (
      <span
        className={cn(
          l.quantidade > 0 ? 'text-sucesso' : 'text-texto',
          l.estornado && 'line-through opacity-60',
        )}
      >
        {l.quantidade > 0 ? '+' : '−'}
        {fmtQtd(Math.abs(l.quantidade))}
      </span>
    ),
  },
  {
    chave: 'saldoApos',
    cabecalho: 'Saldo',
    texto: (l) => fmtQtd(l.saldoApos),
    valor: (l) => l.saldoApos,
    numerica: true,
    larguraMin: '7rem',
    celula: (l) => (
      <span className={cn('font-medium', l.saldoApos < 0 && 'text-perigo')}>
        {fmtQtd(l.saldoApos)}
      </span>
    ),
  },
  {
    chave: 'custoUnitario',
    cabecalho: 'Custo Unit.',
    texto: (l) => moeda(l.custoUnitario),
    valor: (l) => l.custoUnitario,
    numerica: true,
    larguraMin: '7rem',
  },
  {
    chave: 'fornecedor',
    cabecalho: 'Fornecedor',
    texto: (l) => l.fornecedor ?? 'Interno',
    celula: (l) =>
      l.fornecedor ? l.fornecedor : <span className="text-texto-fraco">Interno</span>,
    larguraMin: '11rem',
  },
  {
    chave: 'documento',
    cabecalho: 'Nota',
    texto: (l) => l.documento || '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'observacao',
    cabecalho: 'Observação',
    texto: (l) => l.observacao || '—',
    celula: (l) =>
      l.observacao ? (
        <span className="block max-w-[28rem] truncate" title={l.observacao}>
          {l.observacao}
        </span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
    larguraMin: '14rem',
  },
  {
    chave: 'usuario',
    cabecalho: 'Usuário',
    texto: (l) => l.usuario || '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaExtrato({ linhas }: { linhas: LinhaExtrato[] }) {
  return (
    <TabelaDados
      id="estoque-extrato"
      legenda="Extrato do produto"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(l) => l.id}
      buscaPlaceholder="Buscar por tipo, fornecedor, observação…"
      nomeExportacao="extrato-estoque"
      vazio={{
        titulo: 'Nenhum movimento neste produto',
        descricao:
          'Assim que houver produção, compra ou venda, cada lançamento aparece aqui com o saldo resultante.',
      }}
    />
  )
}
