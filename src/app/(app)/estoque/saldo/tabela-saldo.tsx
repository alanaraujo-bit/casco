'use client'

import Link from 'next/link'
import { ArrowDownUp, PackagePlus, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { moeda, quantidade } from '@/lib/utils'
import { ROTULO_UNIDADE, type Unidade } from '@/modules/produtos/esquema'
import type { SaldoLista } from '@/modules/estoque/consultas'

/**
 * As colunas seguem a ordem consagrada de uma listagem de estoque:
 * Código · Descrição · Complemento · Categoria · Qtdade Disponível ·
 * Custo Médio Unit. · Valor Venda · Estoque Máximo · Estoque Mínimo · NCM.
 *
 * A operadora lê essa tabela da esquerda para a direita há anos. Reordenar para
 * pôr "o que importa primeiro" economizaria meio segundo por consulta e custaria
 * a fluência inteira dela — as três últimas colunas são de conferência, e
 * nascem escondidas em vez de removidas.
 */

/** Onde o saldo está em relação ao mínimo e ao máximo configurados. */
function situacao(l: SaldoLista): 'critico' | 'baixo' | 'excesso' | 'ok' {
  if (l.quantidade <= 0) return 'critico'
  if (l.estoqueMinimo > 0 && l.quantidade < l.estoqueMinimo) return 'baixo'
  if (l.estoqueMaximo > 0 && l.quantidade > l.estoqueMaximo) return 'excesso'
  return 'ok'
}

const colunas: Coluna<SaldoLista>[] = [
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (l) => (l.codigo ? String(l.codigo).padStart(4, '0') : '—'),
    valor: (l) => l.codigo ?? 0,
    numerica: true,
    larguraMin: '5rem',
    papelMobile: 'oculto',
  },
  {
    chave: 'nome',
    cabecalho: 'Descrição',
    texto: (l) => l.nome,
    celula: (l) => (
      <span className="flex items-center gap-2">
        <span className="truncate">{l.nome}</span>
        {!l.ativo && (
          <Badge variant="neutro" className="shrink-0">
            inativo
          </Badge>
        )}
      </span>
    ),
    fixa: true,
    larguraMin: '15rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'sku',
    cabecalho: 'Complemento',
    texto: (l) => l.sku || '—',
    celula: (l) => (l.sku ? l.sku : <span className="text-texto-fraco">—</span>),
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'categoria',
    cabecalho: 'Categoria',
    texto: (l) => l.categoria || '—',
    celula: (l) => (l.categoria ? l.categoria : <span className="text-texto-fraco">—</span>),
  },
  {
    chave: 'quantidade',
    cabecalho: 'Qtdade Disponível',
    texto: (l) => `${quantidade(l.quantidade)} ${ROTULO_UNIDADE[l.unidade as Unidade] ?? l.unidade}`,
    valor: (l) => l.quantidade,
    numerica: true,
    larguraMin: '9rem',
    papelMobile: 'destaque',
    celula: (l) => {
      const s = situacao(l)
      // Só o que exige ação fica colorido. Pintar as três situações faria a
      // tabela inteira virar semáforo, e aí nenhuma cor quer dizer nada.
      const cor =
        s === 'critico' ? 'text-perigo' : s === 'baixo' ? 'text-alerta' : undefined
      const aviso =
        s === 'critico'
          ? l.quantidade < 0
            ? `Saldo negativo: saiu mais do que entrou. Falta lançar entrada.`
            : 'Sem estoque'
          : s === 'baixo'
            ? `Abaixo do mínimo (${quantidade(l.estoqueMinimo)})`
            : s === 'excesso'
              ? `Acima do máximo (${quantidade(l.estoqueMaximo)})`
              : undefined

      return (
        <span
          className={cor ? `inline-flex items-center gap-1 font-medium ${cor}` : undefined}
          title={aviso}
        >
          {cor && <TriangleAlert className="size-3.5 shrink-0" aria-hidden />}
          {quantidade(l.quantidade)}
          {aviso && <span className="sr-only"> — {aviso}</span>}
        </span>
      )
    },
  },
  {
    chave: 'custoMedio',
    cabecalho: 'Custo Médio Unit.',
    texto: (l) => moeda(l.custoMedio),
    valor: (l) => l.custoMedio,
    numerica: true,
    larguraMin: '9rem',
  },
  {
    chave: 'precoPadrao',
    cabecalho: 'Valor Venda',
    texto: (l) => moeda(l.precoPadrao),
    valor: (l) => l.precoPadrao,
    numerica: true,
    larguraMin: '8rem',
  },
  {
    chave: 'valorEmEstoque',
    cabecalho: 'Valor em Estoque',
    texto: (l) => moeda(l.valorEmEstoque),
    valor: (l) => l.valorEmEstoque,
    numerica: true,
    larguraMin: '9rem',
    papelMobile: 'oculto',
  },
  {
    chave: 'estoqueMaximo',
    cabecalho: 'Estoque Máximo',
    texto: (l) => (l.estoqueMaximo > 0 ? quantidade(l.estoqueMaximo) : '—'),
    valor: (l) => l.estoqueMaximo,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'estoqueMinimo',
    cabecalho: 'Estoque Mínimo',
    texto: (l) => (l.estoqueMinimo > 0 ? quantidade(l.estoqueMinimo) : '—'),
    valor: (l) => l.estoqueMinimo,
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'ncm',
    cabecalho: 'NCM',
    texto: (l) => l.ncm || '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaSaldo({ linhas }: { linhas: SaldoLista[] }) {
  return (
    <TabelaDados
      id="estoque-saldo"
      legenda="Saldo em estoque por produto"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(l) => l.id}
      linkDaLinha={(l) => `/estoque/saldo/${l.id}`}
      buscaPlaceholder="Buscar por produto, categoria, NCM…"
      nomeExportacao="estoque"
      acoesTopo={
        <>
          <Button asChild variant="secundario">
            <Link href="/estoque/entradas">
              <ArrowDownUp aria-hidden />
              Movimentos
            </Link>
          </Button>
          <Button asChild variant="primario">
            <Link href="/estoque/entradas/nova">
              <PackagePlus aria-hidden />
              Nova entrada
            </Link>
          </Button>
        </>
      }
      vazio={{
        titulo: 'Nenhum produto controla estoque',
        descricao:
          'O saldo aparece aqui para os produtos marcados como "controla estoque" no cadastro.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/cadastro/produtos">Ver produtos</Link>
          </Button>
        ),
      }}
    />
  )
}
