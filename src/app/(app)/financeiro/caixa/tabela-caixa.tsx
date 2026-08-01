'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { moeda } from '@/lib/utils'
import type { MovimentoCaixa } from '@/modules/financeiro/consultas'

/** dd/mm/aaaa ordena por dia se comparado como texto. Vira Date. */
function data(br: string) {
  const [d, m, a] = br.split('/')
  return new Date(Number(a), Number(m) - 1, Number(d))
}

const colunas: Coluna<MovimentoCaixa>[] = [
  {
    chave: 'data',
    cabecalho: 'Data',
    texto: (m) => m.data,
    valor: (m) => data(m.data),
    fixa: true,
    larguraMin: '7rem',
    papelMobile: 'campo',
  },
  {
    chave: 'descricao',
    cabecalho: 'Descrição',
    texto: (m) => m.descricao ?? m.categoria ?? '—',
    larguraMin: '18rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'categoria',
    cabecalho: 'Categoria',
    texto: (m) => m.categoria ?? '—',
    larguraMin: '10rem',
  },
  { chave: 'conta', cabecalho: 'Banco / Caixa', texto: (m) => m.conta, larguraMin: '9rem' },
  {
    chave: 'valor',
    cabecalho: 'Valor',
    // O sinal é do sentido, e a cor acompanha. Uma coluna só, com sinal, em vez
    // de duas colunas "entrada" e "saída" meio vazias: a operadora lê o extrato
    // de cima a baixo procurando o que não reconhece, e duas colunas obrigam o
    // olho a alternar de lado a cada linha.
    texto: (m) =>
      `${m.sentido === 'entrada' ? '+' : '−'} ${moeda(Number(m.valor))}`,
    valor: (m) => (m.sentido === 'entrada' ? Number(m.valor) : -Number(m.valor)),
    numerica: true,
    celula: (m) => (
      <span
        className={
          m.sentido === 'entrada'
            ? 'flex items-center justify-end gap-1 font-medium tabular-nums text-sucesso'
            : 'flex items-center justify-end gap-1 font-medium tabular-nums text-perigo'
        }
      >
        {m.sentido === 'entrada' ? (
          <ArrowDownLeft className="size-3.5" aria-hidden />
        ) : (
          <ArrowUpRight className="size-3.5" aria-hidden />
        )}
        {moeda(Number(m.valor))}
      </span>
    ),
    papelMobile: 'destaque',
  },
  {
    chave: 'usuario',
    cabecalho: 'Lançado por',
    texto: (m) => m.usuario ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaCaixa({ linhas }: { linhas: MovimentoCaixa[] }) {
  return (
    <TabelaDados
      id="financeiro-caixa"
      legenda="Movimentos de caixa"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(m) => m.id}
      buscaPlaceholder="Buscar por descrição, categoria ou conta…"
      nomeExportacao="caixa"
      densidadePadrao="compacta"
      vazio={{
        titulo: 'Nenhum movimento de caixa',
        descricao:
          'Cada venda recebida e cada título baixado entra aqui automaticamente, com a taxa da maquininha já descontada.',
      }}
    />
  )
}
