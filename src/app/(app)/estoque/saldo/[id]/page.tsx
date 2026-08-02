import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, PackagePlus } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, moeda, quantidade as fmtQtd } from '@/lib/utils'
import { acharSaldoProduto, extratoProduto } from '@/modules/estoque/consultas'
import { TabelaExtrato } from './tabela-extrato'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const produto = await acharSaldoProduto(id)
  return { title: produto ? `Estoque — ${produto.nome}` : 'Produto não encontrado' }
}

export default async function PaginaExtratoProduto({ params }: Props) {
  const { id } = await params

  const [produto, linhas] = await Promise.all([acharSaldoProduto(id), extratoProduto(id)])

  // `null` aqui é produto inexistente **ou** de outra distribuidora — a consulta
  // roda sob RLS, então as duas situações são a mesma e nenhuma revela a outra.
  if (!produto) notFound()

  const abaixoDoMinimo = produto.estoqueMinimo > 0 && produto.quantidade < produto.estoqueMinimo
  const acimaDoMaximo = produto.estoqueMaximo > 0 && produto.quantidade > produto.estoqueMaximo

  const cartoes = [
    {
      rotulo: 'Em estoque',
      valor: `${fmtQtd(produto.quantidade)} ${produto.unidade}`,
      alerta: produto.quantidade < 0 || abaixoDoMinimo,
    },
    { rotulo: 'Custo médio unitário', valor: moeda(produto.custoMedio), alerta: false },
    {
      rotulo: 'Valor em estoque',
      valor: moeda(Math.max(produto.quantidade, 0) * produto.custoMedio),
      alerta: false,
    },
    {
      rotulo: 'Mínimo · Máximo',
      valor: `${produto.estoqueMinimo > 0 ? fmtQtd(produto.estoqueMinimo) : '—'} · ${
        produto.estoqueMaximo > 0 ? fmtQtd(produto.estoqueMaximo) : '—'
      }`,
      alerta: false,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo={produto.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {produto.codigo && <span>Produto {String(produto.codigo).padStart(4, '0')}</span>}
            {!produto.ativo && <Badge variant="neutro">inativo</Badge>}
            {!produto.controlaEstoque && <Badge variant="alerta">não controla estoque</Badge>}
          </span>
        }
        acoes={
          <>
            <Button asChild variant="secundario">
              <Link href="/estoque/saldo">
                <ArrowLeft aria-hidden />
                Voltar
              </Link>
            </Button>
            <Button asChild variant="primario">
              <Link href="/estoque/entradas/nova">
                <PackagePlus aria-hidden />
                Novo movimento
              </Link>
            </Button>
          </>
        }
      />

      <Card className="p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cartoes.map((c) => (
            <div
              key={c.rotulo}
              className="rounded-md border border-borda bg-superficie-afundada px-3 py-2"
            >
              <p className="truncate text-xs text-texto-suave">{c.rotulo}</p>
              <p
                className={cn(
                  'text-xl font-semibold tabular-nums',
                  c.alerta ? 'text-perigo' : 'text-texto',
                )}
              >
                {c.valor}
              </p>
            </div>
          ))}
        </div>

        {/* O aviso fica junto do número que o motivou, e não num banner no topo:
            a operadora está olhando o saldo, e é aqui que a frase serve. */}
        {(produto.quantidade < 0 || abaixoDoMinimo || acimaDoMaximo) && (
          <p
            className={cn(
              'mt-3 text-sm',
              produto.quantidade < 0 || abaixoDoMinimo ? 'text-perigo' : 'text-alerta',
            )}
          >
            {produto.quantidade < 0
              ? 'Saldo negativo: saiu mais do que entrou. Falta lançar a entrada que originou essas saídas.'
              : abaixoDoMinimo
                ? `Abaixo do estoque mínimo de ${fmtQtd(produto.estoqueMinimo)} ${produto.unidade}.`
                : `Acima do estoque máximo de ${fmtQtd(produto.estoqueMaximo)} ${produto.unidade}.`}
          </p>
        )}
      </Card>

      <TabelaExtrato linhas={linhas} />
    </div>
  )
}
