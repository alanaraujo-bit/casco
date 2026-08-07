import type * as React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Truck } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { exigirSessao } from '@/lib/dal'
import { formatarData, formatarDataHora, formatarDataISO, formatarTelefone } from '@/lib/formatos'
import { cn, moeda } from '@/lib/utils'
import {
  acharVenda,
  itensDaVenda,
  listarEntregadoresParaVenda,
  pagamentosDaVenda,
  titulosDaVenda,
  vasilhameDaVenda,
} from '@/modules/vendas/consultas'
import { FormularioEntrega } from './formulario-entrega'

export const metadata: Metadata = { title: 'Venda' }

const OPERACAO: Record<string, string> = {
  pdv: 'PDV',
  balcao: 'Balcão',
  entrega: 'Entrega',
  whatsapp: 'WhatsApp',
}

const MOTIVO: Record<string, string> = {
  entregue: 'Entregue ao cliente',
  devolvido: 'Devolvido pelo cliente',
}

/** `2` e não `2,000`: o banco guarda a quantidade com três casas. */
const quantidade = (valor: string) => Number(valor).toLocaleString('pt-BR')

/**
 * Uma venda inteira, aberta.
 *
 * A tela existe porque a listagem responde "o que aconteceu hoje" e há uma
 * segunda pergunta que ela não responde: **por que este número está assim.** É a
 * pergunta de quem conferiu o caixa e achou R$ 40 a menos, ou de quem ouviu do
 * cliente que devolveu cinco galões e não três — e hoje, para respondê-la, a
 * operadora precisa abrir Contas a Receber, Movimentos de Vasilhame e Estoque em
 * três abas e cruzar datas na mão.
 *
 * Então tudo que a venda gerou está aqui, em blocos, na ordem em que a conversa
 * acontece: o que foi vendido, quanto foi cobrado, como foi pago, e que
 * vasilhame andou. Cada bloco aponta de volta para a tela onde aquilo se
 * resolve, porque conferir e corrigir são dois trabalhos diferentes.
 */
export default async function PaginaVenda({ params }: PageProps<'/vendas/produtos/[id]'>) {
  const { id } = await params

  const [sessao, venda] = await Promise.all([exigirSessao(), acharVenda(id)])
  // A RLS já garante que uma venda de outra distribuidora não é encontrada — o
  // 404 aqui é o mesmo caminho para "não existe" e "não é sua", que é o que
  // evita a tela confirmar a existência de dado alheio.
  if (!venda) notFound()

  const [itens, pagamentos, titulos, vasilhame, entregadores] = await Promise.all([
    itensDaVenda(venda.id),
    pagamentosDaVenda(venda.id),
    titulosDaVenda(venda.id),
    vasilhameDaVenda(venda.id),
    listarEntregadoresParaVenda(),
  ])

  const cancelada = venda.status === 'cancelada'
  const codigo = venda.codigo ? String(venda.codigo).padStart(4, '0') : '—'

  const agua = itens.filter((i) => i.retornavel).reduce((s, i) => s + Number(i.quantidade), 0)
  const devolvido = itens.reduce((s, i) => s + i.vasilhameDevolvido, 0)
  const recebido = pagamentos.reduce((s, p) => s + Number(p.valor), 0)
  const emAberto = titulos
    .filter((t) => !t.pagoEm)
    .reduce((s, t) => s + Number(t.valorParcela), 0)

  const resumo: { rotulo: string; valor: React.ReactNode }[] = [
    {
      rotulo: 'Cliente',
      valor: venda.clienteId ? (
        <Link
          href={`/cadastro/clientes/${venda.clienteId}`}
          className="font-medium text-acento-texto hover:underline"
        >
          {venda.cliente}
        </Link>
      ) : (
        // Não é dado faltando: é o caso mais comum do balcão.
        <span className="text-texto-suave">Consumidor no balcão</span>
      ),
    },
    {
      rotulo: 'Telefone',
      valor: venda.clienteTelefone ? formatarTelefone(venda.clienteTelefone) : '—',
    },
    { rotulo: 'Vendedor', valor: venda.vendedor ?? '—' },
    {
      rotulo: 'Entregador',
      valor: venda.entregador ? (
        <span className="inline-flex items-center gap-1.5">
          {venda.entregador}
          {venda.entregadorAtivo === false && <Badge variant="neutro">inativo</Badge>}
        </span>
      ) : (
        <span className="text-texto-fraco">Não marcado</span>
      ),
    },
    { rotulo: 'Operação', valor: OPERACAO[venda.operacao] ?? venda.operacao },
    { rotulo: 'Parcelas', valor: String(venda.parcelas) },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo={`Venda ${codigo}`}
        descricao={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{formatarDataHora(venda.criadoEm)}</span>
            <span aria-hidden>·</span>
            <span>{venda.cliente ?? 'Consumidor no balcão'}</span>
            {cancelada && <Badge variant="perigo">Cancelada</Badge>}
            {venda.status === 'orcamento' && <Badge variant="alerta">Orçamento</Badge>}
          </span>
        }
        acoes={
          <Button asChild variant="secundario">
            <Link href="/vendas/produtos">
              <ArrowLeft aria-hidden />
              Voltar
            </Link>
          </Button>
        }
      />

      {/* -------------------------------------------------------- os números */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Total da venda" valor={moeda(Number(venda.total))} destaque />
        <Numero
          rotulo="Água entregue"
          valor={`${agua.toLocaleString('pt-BR')} ${agua === 1 ? 'galão' : 'galões'}`}
          detalhe={`${devolvido} ${devolvido === 1 ? 'vasilhame recolhido' : 'vasilhames recolhidos'}`}
        />
        <Numero
          rotulo="Recebido"
          valor={moeda(recebido)}
          detalhe={
            Number(venda.taxas) > 0
              ? `${moeda(Number(venda.taxas))} de taxa descontada`
              : 'sem taxa'
          }
          tom={recebido > 0 ? 'sucesso' : undefined}
        />
        <Numero
          rotulo="Em aberto"
          valor={moeda(emAberto)}
          detalhe={
            titulos.length > 0
              ? `${titulos.length} ${titulos.length === 1 ? 'parcela' : 'parcelas'} em Contas a Receber`
              : 'nada a receber'
          }
          tom={emAberto > 0 ? 'alerta' : undefined}
        />
      </div>

      {/* ------------------------------------------------------- quem é quem */}
      <Card className="p-4 md:p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
          {resumo.map((r) => (
            <div key={r.rotulo} className="min-w-0">
              <dt className="text-xs text-texto-suave">{r.rotulo}</dt>
              <dd className="truncate font-medium text-texto">{r.valor}</dd>
            </div>
          ))}
        </dl>

        {venda.observacao && (
          <p className="mt-3 border-t border-borda pt-3 text-sm text-texto-suave">
            <span className="text-xs text-texto-fraco">Observação: </span>
            {venda.observacao}
          </p>
        )}
      </Card>

      {/* ---------------------------------------------------------- os itens */}
      <Card className="overflow-hidden">
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">O que foi vendido</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-borda text-2xs uppercase tracking-wide text-texto-fraco">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Produto
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Qtd
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Preço
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Vasilhame recolhido
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda/60">
              {itens.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-1.5">
                    <Link
                      href={`/cadastro/produtos/${i.produtoId}`}
                      className="font-medium text-texto hover:text-acento-texto hover:underline"
                    >
                      {i.produto}
                    </Link>
                    {i.codigo !== null && (
                      <span className="ml-2 text-2xs tabular-nums text-texto-fraco">
                        {String(i.codigo).padStart(4, '0')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {quantidade(i.quantidade)}
                    <span className="ml-1 text-2xs text-texto-fraco">{i.unidade}</span>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-texto-suave">
                    {moeda(Number(i.precoUnitario))}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-texto-suave">
                    {i.vasilhameDevolvido > 0 ? i.vasilhameDevolvido : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums text-texto">
                    {moeda(Number(i.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="space-y-1 border-t border-borda bg-superficie-afundada px-4 py-3 text-sm">
          <Linha rotulo="Subtotal" valor={moeda(Number(venda.subtotal))} />
          {Number(venda.desconto) > 0 && (
            // Desconto é linha própria e nunca embutido no preço do item — é o
            // que permite responder "quanto demos de desconto este mês".
            <Linha
              rotulo="Desconto"
              valor={`− ${moeda(Number(venda.desconto))}`}
              className="text-alerta"
            />
          )}
          <Linha
            rotulo="Total"
            valor={moeda(Number(venda.total))}
            className="border-t border-borda pt-1 text-base font-semibold text-texto"
          />
        </dl>
      </Card>

      {/* ----------------------------------------------------- o recebimento */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Como foi pago</h2>
          </div>

          <div className="space-y-3 p-4">
            {pagamentos.length === 0 && titulos.length === 0 && (
              <p className="text-sm text-texto-suave">
                Nenhum pagamento nem título registrado nesta venda.
              </p>
            )}

            {pagamentos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-texto">{p.forma ?? 'Forma removida'}</p>
                  <p className="text-xs text-texto-fraco">
                    {formatarDataHora(p.recebidoEm)}
                    {p.conta && ` · entrou em ${p.conta}`}
                    {Number(p.taxa) > 0 && ` · taxa de ${moeda(Number(p.taxa))}`}
                  </p>
                </div>
                <span className="tabular-nums font-medium text-sucesso">
                  {moeda(Number(p.valor))}
                </span>
              </div>
            ))}

            {titulos.map((t) => (
              <div key={t.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/financeiro/receber/${t.id}`}
                    className="text-sm font-medium text-acento-texto hover:underline"
                  >
                    Parcela {t.parcelaNumero}/{t.parcelaTotal}
                  </Link>
                  <p className="text-xs text-texto-fraco">
                    vence em {formatarDataISO(t.vencimento)}
                    {t.pagoEm && ` · recebida em ${formatarDataISO(t.pagoEm)}`}
                  </p>
                </div>
                <span
                  className={cn(
                    'tabular-nums font-medium',
                    t.pagoEm ? 'text-sucesso' : 'text-alerta',
                  )}
                >
                  {moeda(Number(t.pagoEm ? (t.valorPago ?? t.valorParcela) : t.valorParcela))}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ------------------------------------------------------- o vasilhame */}
        <Card className="overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 border-b border-borda px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Vasilhame movimentado</h2>
            {venda.clienteId && (
              <Link
                href="/vasilhame/saldos"
                className="shrink-0 text-xs font-medium text-acento-texto hover:underline"
              >
                Ver saldo do cliente
              </Link>
            )}
          </div>

          <div className="space-y-3 p-4">
            {vasilhame.length === 0 ? (
              <p className="text-sm text-texto-suave">
                {venda.clienteId
                  ? 'Nenhum galão saiu ou voltou nesta venda.'
                  : 'Venda avulsa não gera comodato: sem cliente identificado não há a quem cobrar o vasilhame.'}
              </p>
            ) : (
              vasilhame.map((m) => (
                <div key={m.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-texto">{m.produto}</p>
                    <p className="text-xs text-texto-fraco">{MOTIVO[m.motivo] ?? m.motivo}</p>
                  </div>
                  {/* O sinal é o significado: positivo saiu da empresa,
                      negativo voltou. Mostrar sempre positivo esconderia
                      justamente a devolução. */}
                  <span
                    className={cn(
                      'tabular-nums font-medium',
                      m.quantidade > 0 ? 'text-alerta' : 'text-sucesso',
                    )}
                  >
                    {m.quantidade > 0 ? '+' : '−'}
                    {Math.abs(m.quantidade)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------- a correção */}
      {cancelada ? (
        <Card className="p-4 md:p-5">
          <p className="text-sm text-texto-suave">
            Esta venda está cancelada e não aceita mais alteração.
          </p>
        </Card>
      ) : sessao.papel !== 'dono' ? (
        <Card className="p-4 md:p-5">
          <p className="text-sm text-texto-suave">
            Só quem é dono edita esta venda. Sua conta enxerga tudo aqui, mas não grava alteração.
          </p>
        </Card>
      ) : (
        <FormularioEntrega
          vendaId={venda.id}
          entregadorId={venda.entregadorId}
          entregadorNome={venda.entregador}
          observacao={venda.observacao}
          entregadores={entregadores}
        />
      )}

      <p className="flex items-center gap-2 text-xs text-texto-fraco">
        <Truck className="size-3.5 shrink-0" aria-hidden />
        <span>
          O total desta venda entra no{' '}
          <Link
            href="/relatorios/entregadores"
            className="font-medium text-acento-texto hover:underline"
          >
            Desempenho dos Entregadores
          </Link>{' '}
          na data de {formatarData(venda.criadoEm)}.
        </span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ peças locais */

function Numero({
  rotulo,
  valor,
  detalhe,
  tom,
  destaque,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'sucesso' | 'alerta'
  destaque?: boolean
}) {
  return (
    <Card className="p-3">
      <p className="truncate text-xs text-texto-suave">{rotulo}</p>
      <p
        className={cn(
          'truncate font-semibold tabular-nums text-texto',
          destaque ? 'text-xl' : 'text-lg',
          tom === 'sucesso' && 'text-sucesso',
          tom === 'alerta' && 'text-alerta',
        )}
      >
        {valor}
      </p>
      {detalhe && <p className="truncate text-2xs text-texto-fraco">{detalhe}</p>}
    </Card>
  )
}

function Linha({
  rotulo,
  valor,
  className,
}: {
  rotulo: string
  valor: string
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 text-texto-suave', className)}>
      <dt>{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  )
}
