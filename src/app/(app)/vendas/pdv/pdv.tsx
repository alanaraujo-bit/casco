'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  Check,
  CircleAlert,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Truck,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn, moeda } from '@/lib/utils'
import { centavos, deCentavos, paraNumero, type EstadoVenda } from '@/modules/vendas/esquema'
import type {
  ClienteVenda,
  FormaVenda,
  PrecoTabela,
  ProdutoVenda,
} from '@/modules/vendas/consultas'

type Props = {
  acao: (anterior: EstadoVenda, form: FormData) => Promise<EstadoVenda>
  produtos: ProdutoVenda[]
  precos: PrecoTabela[]
  clientes: ClienteVenda[]
  formas: FormaVenda[]
  tabelaPadraoId: string | null
}

interface LinhaCarrinho {
  produtoId: string
  quantidade: number
  vasilhameDevolvido: number
}

/**
 * O PDV.
 *
 * Três decisões carregam a tela inteira:
 *
 * **O carrinho é uma lista, não um formulário.** A operadora clica no produto e
 * ele entra; clicar de novo soma um. Não existe "adicionar item" com quantidade,
 * preço e botão confirmar — esse é o desenho que faz uma venda de três galões
 * levar nove cliques.
 *
 * **O preço aparece, mas quem decide é o servidor.** A tela resolve a tabela do
 * cliente para mostrar o valor certo na hora; o total gravado é recalculado no
 * `fecharVenda`. Se os dois discordarem, o banco vence — e a diferença nunca
 * chega a existir, porque as duas leem a mesma tabela de preço.
 *
 * **Vasilhame vive dentro do item.** Ao vender um produto retornável, aparece
 * na linha um contador de "galões que ele trouxe". É o momento em que a pergunta
 * é feita de verdade no balcão — e é a única forma de o comodato não depender de
 * alguém lembrar de abrir outra tela depois que o cliente já foi embora.
 */
export function Pdv({ acao, produtos, precos, clientes, formas, tabelaPadraoId }: Props) {
  const [estado, enviar] = useActionState<EstadoVenda, FormData>(acao, {})

  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([])
  const [clienteId, setClienteId] = useState('')
  const [formaId, setFormaId] = useState(
    formas.find((f) => f.tipo === 'dinheiro')?.id ?? formas[0]?.id ?? '',
  )
  const [desconto, setDesconto] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [valorRecebido, setValorRecebido] = useState('')
  const [observacao, setObservacao] = useState('')
  const [busca, setBusca] = useState('')

  const buscaRef = useRef<HTMLInputElement>(null)

  const cliente = clientes.find((c) => c.id === clienteId) ?? null
  const forma = formas.find((f) => f.id === formaId) ?? null
  const fiado = forma?.tipo === 'fiado'

  /* ------------------------------------------------------------------ preço */

  /**
   * A mesma cascata do servidor: tabela do cliente → tabela padrão → preço do
   * cadastro. Repetida aqui porque o número precisa aparecer antes do envio;
   * se um dia divergirem, quem grava é o servidor.
   */
  const tabelaId = cliente?.tabelaPrecoId ?? tabelaPadraoId
  const precoDe = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of precos) {
      if (p.tabelaId === tabelaId) mapa.set(p.produtoId, centavos(Number(p.preco)))
    }
    return (produtoId: string) =>
      mapa.get(produtoId) ??
      centavos(Number(produtos.find((p) => p.id === produtoId)?.precoPadrao ?? 0))
  }, [precos, produtos, tabelaId])

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])

  /* --------------------------------------------------------------- carrinho */

  function adicionar(produtoId: string) {
    setCarrinho((atual) => {
      const existente = atual.find((l) => l.produtoId === produtoId)
      if (existente) {
        return atual.map((l) =>
          l.produtoId === produtoId
            ? { ...l, quantidade: Math.min(9999, l.quantidade + 1) }
            : l,
        )
      }
      return [...atual, { produtoId, quantidade: 1, vasilhameDevolvido: 0 }]
    })
  }

  function mudarQuantidade(produtoId: string, delta: number) {
    setCarrinho((atual) =>
      atual.flatMap((l) => {
        if (l.produtoId !== produtoId) return [l]
        const nova = l.quantidade + delta
        // Chegar a zero remove a linha. Manter um item com quantidade 0 no
        // carrinho é um estado que só serve para ir parar na venda.
        if (nova < 1) return []
        return [
          {
            ...l,
            quantidade: Math.min(9999, nova),
            // O cliente não pode devolver mais galões do que está levando.
            vasilhameDevolvido: Math.min(l.vasilhameDevolvido, Math.min(9999, nova)),
          },
        ]
      }),
    )
  }

  function mudarDevolvido(produtoId: string, delta: number) {
    setCarrinho((atual) =>
      atual.map((l) =>
        l.produtoId === produtoId
          ? {
              ...l,
              vasilhameDevolvido: Math.max(
                0,
                Math.min(l.quantidade, l.vasilhameDevolvido + delta),
              ),
            }
          : l,
      ),
    )
  }

  function remover(produtoId: string) {
    setCarrinho((atual) => atual.filter((l) => l.produtoId !== produtoId))
  }

  /* ----------------------------------------------------------------- totais */

  const subtotal = carrinho.reduce((soma, l) => soma + precoDe(l.produtoId) * l.quantidade, 0)
  const descontoCent = Math.max(0, centavos(paraNumero(desconto) || 0))
  const total = Math.max(0, subtotal - descontoCent)
  const taxa = fiado || !forma ? 0 : Math.round((total * Number(forma.taxaPercentual)) / 100)
  const recebidoCent = centavos(paraNumero(valorRecebido) || 0)
  const troco = forma?.tipo === 'dinheiro' && recebidoCent > total ? recebidoCent - total : 0

  const galoesNaVenda = carrinho.reduce(
    (soma, l) => (porId.get(l.produtoId)?.retornavel ? soma + l.quantidade : soma),
    0,
  )

  const descontoExcede = descontoCent > 0 && descontoCent >= subtotal && subtotal > 0

  /* -------------------------------------------------------------- resultado */

  /**
   * Depois de fechar, a tela fica pronta para o próximo cliente — mas não
   * zerada. A forma de pagamento fica, porque é a mesma o dia inteiro; o
   * carrinho, o cliente e o desconto limpam, porque é outra venda.
   *
   * Ajustado em render e não em efeito: um `setState` dentro de `useEffect`
   * pinta a tela uma vez com o carrinho antigo ainda visível. É a piscada que o
   * `AGENTS.md` proíbe, e ela cairia exatamente no momento em que a operadora
   * olha para conferir o que gravou.
   */
  const [ultimaFechada, setUltimaFechada] = useState(0)
  if (estado.recibo && estado.tentativa !== ultimaFechada) {
    setUltimaFechada(estado.tentativa ?? 0)
    setCarrinho([])
    setClienteId('')
    setDesconto('')
    setParcelas('1')
    setValorRecebido('')
    setObservacao('')
    setBusca('')
  }

  useEffect(() => {
    if (estado.recibo) buscaRef.current?.focus()
  }, [estado])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        String(p.codigo ?? '').padStart(4, '0').includes(termo),
    )
  }, [busca, produtos])

  if (produtos.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">Nenhum produto cadastrado</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          O PDV vende o que está no cadastro de produtos. Cadastre a água e o gás, com preço, e
          a venda de balcão funciona no mesmo minuto.
        </p>
        <Button asChild variant="primario" className="mt-4">
          <Link href="/cadastro/produtos">Ir para Produtos</Link>
        </Button>
      </Card>
    )
  }

  if (formas.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <Wallet className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">Nenhuma forma de pagamento ativa</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          Sem forma de pagamento não há como dizer se a venda entrou no caixa ou virou fiado.
        </p>
      </Card>
    )
  }

  return (
    <form action={enviar} className="space-y-4" noValidate>
      {/* O único campo escondido é o carrinho: ele é uma lista, e lista não tem
          controle de formulário. Todo o resto são campos de verdade, com
          `name`, e é isso que faz a venda ser enviada mesmo se o React ainda
          não tiver assumido a página. */}
      <input type="hidden" name="itens" value={JSON.stringify(carrinho)} />

      {estado.recibo && <Recibo recibo={estado.recibo} />}

      {estado.erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_25rem]">
        {/* ------------------------------------------------------- catálogo */}
        <div className="space-y-4">
          <Card className="p-4 md:p-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco"
                aria-hidden
              />
              <Input
                ref={buscaRef}
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adiciona o primeiro resultado: é o fluxo de quem digita
                  // o código do produto sem tirar a mão do teclado.
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filtrados[0]) {
                      adicionar(filtrados[0].id)
                      setBusca('')
                    }
                  }
                }}
                placeholder="Buscar produto por nome ou código…"
                aria-label="Buscar produto"
                autoComplete="off"
                className="pl-9"
              />
            </div>

            {filtrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-texto-suave">
                Nenhum produto encontrado para “{busca}”.
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filtrados.map((p) => {
                  const preco = precoDe(p.id)
                  const noCarrinho = carrinho.find((l) => l.produtoId === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => adicionar(p.id)}
                      className={cn(
                        'flex min-h-[4.5rem] flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                        noCarrinho
                          ? 'border-acento-suave-borda bg-acento-suave'
                          : 'border-borda-controle bg-superficie hover:bg-superficie-hover hover:border-borda-forte',
                      )}
                    >
                      <span className="flex w-full items-start justify-between gap-2">
                        <span className="text-sm font-medium text-texto">{p.nome}</span>
                        {noCarrinho && (
                          <Badge variant="info" className="shrink-0 tabular-nums">
                            {noCarrinho.quantidade}
                          </Badge>
                        )}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-texto">
                        {moeda(deCentavos(preco))}
                        {preco === 0 && (
                          <span className="ml-1.5 text-xs font-normal text-alerta">
                            sem preço
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-texto-fraco">
                        {p.retornavel && (
                          <span className="flex items-center gap-1">
                            <Truck className="size-3" aria-hidden />
                            retornável
                          </span>
                        )}
                        {p.controlaEstoque && (
                          // O saldo informa, não trava. Ver a nota em `acoes.ts`.
                          <span
                            className={cn('tabular-nums', p.emEstoque <= 0 && 'text-perigo')}
                          >
                            {p.emEstoque <= 0
                              ? 'sem estoque'
                              : `${p.emEstoque.toLocaleString('pt-BR')} em estoque`}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ------------------------------------------------------ carrinho */}
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-texto">
              <ShoppingCart className="size-4" aria-hidden />
              Itens da venda
              {carrinho.length > 0 && (
                <span className="text-texto-fraco tabular-nums">({carrinho.length})</span>
              )}
            </h2>

            {carrinho.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full bg-superficie-afundada text-texto-suave">
                  <Package className="size-5" aria-hidden />
                </div>
                <p className="mt-3 text-sm font-medium text-texto">Carrinho vazio</p>
                <p className="mx-auto mt-1 max-w-[42ch] text-sm text-texto-suave">
                  Clique num produto acima para começar. Clicar de novo soma mais um.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-borda">
                {carrinho.map((l) => {
                  const p = porId.get(l.produtoId)
                  if (!p) return null
                  const unitario = precoDe(l.produtoId)
                  return (
                    <li key={l.produtoId} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-texto">{p.nome}</p>
                          <p className="text-xs tabular-nums text-texto-suave">
                            {moeda(deCentavos(unitario))} / {p.unidade}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone"
                            onClick={() => mudarQuantidade(l.produtoId, -1)}
                            aria-label={`Diminuir ${p.nome}`}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-texto">
                            {l.quantidade}
                          </span>
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone"
                            onClick={() => mudarQuantidade(l.produtoId, 1)}
                            aria-label={`Aumentar ${p.nome}`}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </div>

                        <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-texto">
                          {moeda(deCentavos(unitario * l.quantidade))}
                        </span>

                        <Button
                          type="button"
                          variant="fantasma"
                          size="icone"
                          onClick={() => remover(l.produtoId)}
                          aria-label={`Remover ${p.nome}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>

                      {/* A pergunta do balcão, no lugar onde ela é feita.
                          Só aparece em produto retornável e com cliente
                          identificado — sem cliente não há comodato a
                          acertar, e o contador prometeria algo que a venda
                          não vai gravar. */}
                      {p.retornavel && clienteId && (
                        <div className="mt-2 flex items-center gap-2 rounded-md bg-superficie-afundada px-3 py-2">
                          <Truck className="size-4 shrink-0 text-texto-suave" aria-hidden />
                          <span className="flex-1 text-xs text-texto-suave">
                            Galões vazios que ele trouxe agora
                          </span>
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone"
                            onClick={() => mudarDevolvido(l.produtoId, -1)}
                            aria-label={`Menos vasilhame devolvido de ${p.nome}`}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-texto">
                            {l.vasilhameDevolvido}
                          </span>
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone"
                            onClick={() => mudarDevolvido(l.produtoId, 1)}
                            aria-label={`Mais vasilhame devolvido de ${p.nome}`}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {estado.campos?.itens && (
              <p className="mt-3 text-xs text-perigo">{estado.campos.itens}</p>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------- cliente e pagamento */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="space-y-4 p-4 md:p-5">
            <div className="space-y-1.5">
              <Label htmlFor="clienteEscolha">
                Cliente
                <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
              </Label>
              <Select
                id="clienteEscolha"
                name="clienteId"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                erro={estado.campos?.clienteId}
              >
                <option value="">Consumidor no balcão</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo ? `${String(c.codigo).padStart(4, '0')} - ` : ''}
                    {c.nome}
                  </option>
                ))}
              </Select>

              {/* Sem cliente, o comodato não tem devedor — e a operadora precisa
                  saber disso antes de fechar, não depois. */}
              {!clienteId && galoesNaVenda > 0 && (
                <p className="text-xs text-alerta">
                  {galoesNaVenda} galão(ões) retornável(is) nesta venda. Sem cliente
                  identificado, o comodato não será registrado.
                </p>
              )}

              {cliente && (
                <div className="space-y-0.5 text-xs text-texto-suave tabular-nums">
                  {cliente.vasilhameNaRua > 0 && (
                    <p>{cliente.nome} está com {cliente.vasilhameNaRua} galão(ões) hoje.</p>
                  )}
                  {Number(cliente.emAberto) > 0 && (
                    <p className="text-alerta">
                      Já tem {moeda(Number(cliente.emAberto))} em aberto
                      {Number(cliente.limiteCredito) > 0 &&
                        ` · limite ${moeda(Number(cliente.limiteCredito))}`}
                      .
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formaEscolha">Forma de pagamento</Label>
              <Select
                id="formaEscolha"
                name="formaId"
                value={formaId}
                onChange={(e) => setFormaId(e.target.value)}
                erro={estado.campos?.formaId}
              >
                {formas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                    {Number(f.taxaPercentual) > 0 &&
                      ` — taxa ${Number(f.taxaPercentual).toLocaleString('pt-BR')}%`}
                  </option>
                ))}
              </Select>
            </div>

            {(fiado || forma?.tipo === 'credito') && (
              <div className="space-y-1.5">
                <Label htmlFor="parcelasCampo">Parcelas</Label>
                <Select
                  id="parcelasCampo"
                  name="parcelas"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  erro={estado.campos?.parcelas}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}× de {moeda(deCentavos(Math.floor(total / n)))}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="descontoCampo">
                Desconto
                <span className="ml-1 font-normal text-texto-fraco">(R$)</span>
              </Label>
              <Input
                id="descontoCampo"
                name="desconto"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                erro={estado.campos?.desconto ?? (descontoExcede ? 'Desconto maior que a venda' : undefined)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                className="text-right tabular-nums"
              />
            </div>

            {forma?.tipo === 'dinheiro' && (
              <div className="space-y-1.5">
                <Label htmlFor="recebidoCampo">
                  Valor recebido
                  <span className="ml-1 font-normal text-texto-fraco">(para o troco)</span>
                </Label>
                <Input
                  id="recebidoCampo"
                  name="valorRecebido"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  erro={estado.campos?.valorRecebido}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="text-right tabular-nums"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="observacaoCampo">
                Observação
                <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
              </Label>
              <Textarea
                id="observacaoCampo"
                name="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                erro={estado.campos?.observacao}
                rows={2}
                maxLength={300}
                placeholder="Entregar na obra da rua 5"
              />
            </div>
          </Card>

          <Card className="p-4 md:p-5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-texto-suave">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{moeda(deCentavos(subtotal))}</dd>
              </div>
              {descontoCent > 0 && (
                <div className="flex justify-between text-texto-suave">
                  <dt>Desconto</dt>
                  <dd className="tabular-nums">− {moeda(deCentavos(descontoCent))}</dd>
                </div>
              )}
              {taxa > 0 && (
                // A linha que o sistema antigo não tem. O dono precisa ver que
                // a maquininha come uma parte antes de achar que recebeu tudo.
                <div className="flex justify-between text-alerta">
                  <dt>Taxa {forma?.nome}</dt>
                  <dd className="tabular-nums">− {moeda(deCentavos(taxa))}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-borda pt-2 text-texto">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {moeda(deCentavos(total))}
                </dd>
              </div>
              {taxa > 0 && (
                <div className="flex justify-between text-xs text-texto-suave">
                  <dt>Entra no caixa</dt>
                  <dd className="tabular-nums">{moeda(deCentavos(total - taxa))}</dd>
                </div>
              )}
              {troco > 0 && (
                <div className="flex items-baseline justify-between rounded-md bg-sucesso-bg px-3 py-2 text-sucesso">
                  <dt className="font-medium">Troco</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {moeda(deCentavos(troco))}
                  </dd>
                </div>
              )}
              {fiado && (
                <div className="rounded-md bg-info-bg px-3 py-2 text-xs text-info">
                  Nada entra no caixa agora. A venda vira{' '}
                  {parcelas === '1' ? 'um título' : `${parcelas} títulos`} em Contas a Receber.
                </div>
              )}
            </dl>

            <BotaoFechar habilitado={carrinho.length > 0 && total > 0} />
          </Card>
        </div>
      </div>
    </form>
  )
}

function BotaoFechar({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      disabled={pending || !habilitado}
      aria-disabled={pending || !habilitado}
      className="mt-4 w-full"
    >
      {pending ? (
        'Fechando…'
      ) : (
        <>
          <Check aria-hidden />
          Fechar venda
        </>
      )}
    </Button>
  )
}

/**
 * O comprovante que fica na tela.
 *
 * Existe pelo mesmo motivo do recibo da baixa de vasilhame: a operadora precisa
 * repetir três números para o cliente antes dele sair — o total, o troco e
 * quantos galões ele ficou devendo. Ter que navegar para outra tela para
 * conferir é o que faz alguém lançar a mesma venda duas vezes.
 */
function Recibo({ recibo }: { recibo: NonNullable<EstadoVenda['recibo']> }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-sucesso-bg bg-sucesso-bg px-4 py-3 text-sm text-sucesso"
    >
      <div className="flex items-start gap-3">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            Venda {recibo.codigo ? `#${recibo.codigo}` : ''} fechada —{' '}
            <span className="tabular-nums">{moeda(recibo.total)}</span> em {recibo.forma}
            {recibo.cliente && ` · ${recibo.cliente}`}
          </p>

          {recibo.troco !== null && recibo.troco > 0 && (
            <p className="text-base font-semibold tabular-nums">
              Troco: {moeda(recibo.troco)}
            </p>
          )}

          {recibo.fiado && (
            <p>
              {recibo.parcelas === 1
                ? `Título gerado em Contas a Receber, vencendo em ${recibo.primeiroVencimento}.`
                : `${recibo.parcelas} parcelas geradas em Contas a Receber, a primeira em ${recibo.primeiroVencimento}.`}
            </p>
          )}

          {recibo.taxa > 0 && (
            <p>
              Taxa de {moeda(recibo.taxa)} descontada — entraram{' '}
              {moeda(recibo.total - recibo.taxa)} no caixa.
            </p>
          )}

          {recibo.vasilhameEntregue > 0 && (
            <p className="tabular-nums">
              {recibo.vasilhameEntregue} galão(ões) entregue(s)
              {recibo.vasilhameDevolvido > 0 && `, ${recibo.vasilhameDevolvido} devolvido(s)`}
              {recibo.saldoVasilhame !== null &&
                ` — ${recibo.cliente} fica com ${recibo.saldoVasilhame}.`}
            </p>
          )}

          <p>
            <Link
              href="/vendas/produtos"
              className="underline underline-offset-2"
            >
              Ver na listagem de vendas
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
