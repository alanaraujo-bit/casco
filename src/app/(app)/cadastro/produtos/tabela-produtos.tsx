'use client'

import Link from 'next/link'
import { PackagePlus, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { ROTULO_UNIDADE, type Unidade } from '@/modules/produtos/esquema'
import type { ProdutoLista } from '@/modules/produtos/consultas'

function formatarMoeda(valor: string | number): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const colunas: Coluna<ProdutoLista>[] = [
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (p) => (p.codigo ? String(p.codigo).padStart(4, '0') : '—'),
    valor: (p) => p.codigo ?? 0,
    numerica: true,
    larguraMin: '5rem',
  },
  {
    chave: 'nome',
    cabecalho: 'Produto',
    texto: (p) => p.nome,
    celula: (p) => (
      <span className="flex items-center gap-2">
        <span className="truncate">{p.nome}</span>
        {p.retornavel && (
          <Badge variant="info" className="shrink-0">
            retornável
          </Badge>
        )}
        {!p.ativo && (
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
    chave: 'categoria',
    cabecalho: 'Categoria',
    texto: (p) => p.categoria || '—',
    celula: (p) =>
      p.categoria ? p.categoria : <span className="text-texto-fraco">—</span>,
  },
  {
    chave: 'unidade',
    cabecalho: 'Unidade',
    texto: (p) => ROTULO_UNIDADE[p.unidade as Unidade] ?? p.unidade,
  },
  {
    chave: 'precoPadrao',
    cabecalho: 'Preço',
    texto: (p) => formatarMoeda(p.precoPadrao),
    valor: (p) => Number(p.precoPadrao),
    numerica: true,
    celula: (p) =>
      Number(p.precoPadrao) > 0 ? (
        <span className="tabular-nums">{formatarMoeda(p.precoPadrao)}</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-alerta">
          <TriangleAlert className="size-3.5" aria-hidden />
          sem preço
        </span>
      ),
  },
  {
    chave: 'custo',
    cabecalho: 'Custo',
    texto: (p) => formatarMoeda(p.custo),
    valor: (p) => Number(p.custo),
    numerica: true,
    celula: (p) => <span className="tabular-nums">{formatarMoeda(p.custo)}</span>,
  },
  {
    chave: 'estoque',
    cabecalho: 'Estoque',
    texto: (p) => String(p.estoque),
    valor: (p) => p.estoque,
    numerica: true,
    celula: (p) => {
      const min = Number(p.estoqueMinimo)
      const abaixo = p.controlaEstoque && min > 0 && p.estoque < min
      return (
        <span
          className={abaixo ? 'font-medium text-perigo' : undefined}
          title={abaixo ? `Abaixo do estoque mínimo (${min})` : undefined}
        >
          {Number(p.estoque).toLocaleString('pt-BR')}
        </span>
      )
    },
  },
]

export function TabelaProdutos({ linhas }: { linhas: ProdutoLista[] }) {
  return (
    <TabelaDados
      id="produtos"
      legenda="Produtos cadastrados"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(p) => p.id}
      linkDaLinha={(p) => `/cadastro/produtos/${p.id}`}
      buscaPlaceholder="Buscar por nome, SKU, categoria…"
      nomeExportacao="produtos"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/cadastro/produtos/novo">
            <PackagePlus aria-hidden />
            Novo produto
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum produto cadastrado',
        descricao:
          'Cadastre o primeiro produto para começar a lançar vendas e controlar estoque.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/cadastro/produtos/novo">
              <PackagePlus aria-hidden />
              Cadastrar primeiro produto
            </Link>
          </Button>
        ),
      }}
    />
  )
}
