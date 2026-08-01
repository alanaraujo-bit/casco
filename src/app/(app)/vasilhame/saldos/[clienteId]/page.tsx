import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatarTelefone } from '@/lib/formatos'
import { extratoCliente, resumoDoCliente } from '@/modules/vasilhame/consultas'
import { TabelaExtrato } from './tabela-extrato'

type Props = { params: Promise<{ clienteId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { clienteId } = await params
  const cliente = await resumoDoCliente(clienteId)
  return { title: cliente ? `Vasilhame — ${cliente.nome}` : 'Cliente não encontrado' }
}

export default async function PaginaExtrato({ params }: Props) {
  const { clienteId } = await params

  const [cliente, linhas] = await Promise.all([
    resumoDoCliente(clienteId),
    extratoCliente(clienteId),
  ])

  // `null` aqui é cliente inexistente **ou** de outra distribuidora — a consulta
  // roda sob RLS, então as duas situações são a mesma e nenhuma revela a outra.
  if (!cliente) notFound()

  const total = cliente.porVasilhame.reduce((soma, v) => soma + v.quantidade, 0)

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo={cliente.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {cliente.codigo && <span>Cliente {String(cliente.codigo).padStart(4, '0')}</span>}
            {cliente.telefone && (
              <a
                href={`tel:${cliente.telefone}`}
                className="text-acento-texto underline-offset-4 hover:underline"
              >
                {formatarTelefone(cliente.telefone)}
              </a>
            )}
            {cliente.bairro && <span className="text-texto-fraco">{cliente.bairro}</span>}
            {!cliente.ativo && <Badge variant="neutro">inativo</Badge>}
          </span>
        }
        acoes={
          <>
            <Button asChild variant="secundario">
              <Link href="/vasilhame/saldos">
                <ArrowLeft aria-hidden />
                Voltar
              </Link>
            </Button>
            <Button asChild variant="primario">
              <Link href="/vasilhame/baixa">
                <ArrowLeftRight aria-hidden />
                Nova baixa
              </Link>
            </Button>
          </>
        }
      />

      {/*
        O saldo por vasilhame vem antes do histórico, e separado por tipo.
        Um total único esconderia justamente a confusão que gera a discussão no
        balcão: devolver um galão de 10L não abate um de 20L, e o cliente que vê
        só "deve 12" não tem como conferir.
      */}
      <Card className="p-4 md:p-5">
        <h2 className="mb-3 text-sm font-semibold text-texto">Em poder do cliente hoje</h2>
        {cliente.porVasilhame.length === 0 ? (
          <p className="text-sm text-texto-suave">
            Nenhum vasilhame registrado para este cliente.
          </p>
        ) : (
          /* Grade e não `flex-1`: esticando, um único vasilhame virava uma
             faixa vazia de ponta a ponta com um número no canto. A grade dá a
             mesma largura de um cartão de métrica das outras telas. */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cliente.porVasilhame.map((v) => (
              <div
                key={v.produtoId}
                className="rounded-md border border-borda bg-superficie-afundada px-3 py-2"
              >
                <p className="truncate text-xs text-texto-suave">{v.produto}</p>
                <p
                  className={`text-xl font-semibold tabular-nums ${
                    v.quantidade < 0 ? 'text-alerta' : 'text-texto'
                  }`}
                >
                  {v.quantidade}
                </p>
              </div>
            ))}
            {cliente.porVasilhame.length > 1 && (
              <div className="rounded-md border border-acento-suave-borda bg-acento-suave px-3 py-2">
                <p className="text-xs text-acento-texto">Total</p>
                <p className="text-xl font-semibold tabular-nums text-acento-texto">{total}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <TabelaExtrato linhas={linhas} />
    </div>
  )
}
