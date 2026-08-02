'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  ArrowDownUp,
  Check,
  CircleAlert,
  Minus,
  Plus,
  Receipt,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn, moeda, quantidade as fmtQtd } from '@/lib/utils'
import { paraNumero } from '@/modules/vendas/esquema'
import {
  REGRA,
  TIPOS_EM_ORDEM,
  type EstadoFormularioMovimento,
} from '@/modules/estoque/esquema'
import type { ProdutoParaMovimento } from '@/modules/estoque/consultas'
import type { TipoEstoque } from '@/db/schema'

type Props = {
  acao: (
    anterior: EstadoFormularioMovimento,
    form: FormData,
  ) => Promise<EstadoFormularioMovimento>
  produtos: ProdutoParaMovimento[]
  fornecedores: { id: string; nome: string }[]
  /** Trinta dias, calculado no servidor no fuso da loja. Sugestão editável. */
  vencimentoSugerido: string
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-texto-suave">{descricao}</p>}
      </div>
      {children}
    </Card>
  )
}

function BotaoLancar({ bloqueado }: { bloqueado?: boolean }) {
  const { pending } = useFormStatus()
  const inativo = pending || bloqueado
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      disabled={inativo}
      aria-disabled={inativo}
      className="w-full sm:w-auto"
    >
      {pending ? (
        'Lançando…'
      ) : (
        <>
          <ArrowDownUp aria-hidden />
          Lançar movimento
        </>
      )}
    </Button>
  )
}

/**
 * A tela que faltava para o estoque saber subir.
 *
 * Três decisões guiam tudo aqui:
 *
 * **O tipo vem primeiro, e como botão.** Escolhido o tipo, o resto do formulário
 * se ajusta — fornecedor e nota aparecem só na compra, a contagem substitui a
 * quantidade no ajuste, o aviso de custo aparece na perda. É o mesmo desenho da
 * baixa de vasilhame, e pelo mesmo motivo: a escolha do tipo *é* a tela.
 *
 * **A operadora nunca digita sinal.** Ela diz o que aconteceu e quantos; o sinal
 * sai de `aplicarSinal()`, no servidor.
 *
 * **O ajuste pergunta quanto ela contou, não a diferença.** Ela foi ao depósito
 * e contou 145 — obrigá-la a calcular "−5" é pedir uma subtração no meio do
 * corredor, e é onde nasce o ajuste com sinal trocado. A tela faz a conta e
 * mostra o lançamento resultante antes de gravar.
 */
export function FormularioEntrada({ acao, produtos, fornecedores, vencimentoSugerido }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioMovimento, FormData>(acao, {})

  const [tipo, setTipo] = useState<TipoEstoque>('producao')
  const [produtoId, setProdutoId] = useState(produtos[0]?.id ?? '')
  const [quantidade, setQuantidade] = useState('1')
  const [contagem, setContagem] = useState('')
  const [custo, setCusto] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [gerarTitulo, setGerarTitulo] = useState(false)

  const formRef = useRef<HTMLFormElement>(null)
  const regra = REGRA[tipo]

  /**
   * A operadora mexeu em alguma coisa desde que apertou "Lançar"?
   *
   * A limpeza abaixo só chega quando a action responde, e entre o clique e a
   * resposta a tela continua viva — ela já pode ter escolhido o tipo do próximo
   * lançamento e digitado a quantidade. Limpar nesse instante apaga o que ela
   * acabou de escrever, sem erro nenhum na tela: o número simplesmente volta
   * para 1. Aqui a resposta é rápida; no `next dev`, com cinco rotas sendo
   * revalidadas, a janela chega a segundos — foi assim que este apareceu.
   *
   * `ref` e não `state` de propósito: isto não desenha nada, e como `state`
   * provocaria um render a cada tecla digitada.
   */
  const mexeuDesdeOEnvio = useRef(false)
  const registrarToque = () => {
    mexeuDesdeOEnvio.current = true
  }

  const produto = produtos.find((p) => p.id === produtoId)
  const saldoAtual = produto?.saldo ?? 0

  /**
   * O custo sugerido acompanha o produto escolhido enquanto a operadora não
   * digitar nada. Depois que ela digita, é dela — sobrescrever o que foi
   * digitado ao trocar de produto é a forma mais rápida de perder um número que
   * ela acabou de conferir na nota.
   */
  const custoEfetivo = custo === '' ? (produto?.custoSugerido ?? 0) : paraNumero(custo)
  const qtdDigitada = paraNumero(quantidade) || 0

  /**
   * No ajuste a quantidade lançada é a diferença entre o contado e o saldo.
   * Enquanto ela não digitou a contagem, não há lançamento nenhum — e o botão
   * fica desabilitado em vez de gravar um ajuste de zero.
   */
  const diferenca = contagem === '' ? 0 : paraNumero(contagem) - saldoAtual
  const ehAjuste = tipo === 'ajuste'
  const qtdLancada = ehAjuste ? Math.abs(diferenca) : qtdDigitada
  const sentido = ehAjuste ? (diferenca >= 0 ? 'entrada' : 'saida') : 'entrada'

  const sinal = ehAjuste ? Math.sign(diferenca) : regra.direcao === 'entrada' ? 1 : -1
  const saldoDepois = saldoAtual + sinal * qtdLancada
  const valorTotal = custoEfetivo * qtdLancada

  const ajusteSemContagem = ehAjuste && (contagem === '' || diferenca === 0)

  const erroDe = (campo: keyof NonNullable<EstadoFormularioMovimento['campos']>) =>
    estado.campos?.[campo]

  /**
   * Depois de gravar, o formulário fica pronto para o próximo lançamento — mas
   * não zerado. Tipo e produto ficam, porque na prática ela lança várias
   * produções do mesmo produto em sequência; quantidade, contagem e nota limpam,
   * porque o próximo lançamento é outro número e outro documento.
   *
   * Ajustado em render e não num efeito: um `setState` dentro de `useEffect`
   * pinta a tela uma vez com o valor antigo antes de limpar, e a piscada cai
   * bem no momento em que a operadora olha para conferir o que gravou.
   */
  const [ultimoLancado, setUltimoLancado] = useState(0)
  if (estado.sucesso && estado.tentativa !== ultimoLancado) {
    setUltimoLancado(estado.tentativa ?? 0)
    // Só limpa o que ela não voltou a tocar. Ver `mexeuDesdeOEnvio` acima.
    if (!mexeuDesdeOEnvio.current) {
      setQuantidade('1')
      setContagem('')
      setGerarTitulo(false)
    }
  }

  /** O foco volta para onde o próximo lançamento começa. */
  useEffect(() => {
    if (!estado.sucesso) return
    const alvo = tipo === 'ajuste' ? 'contagem' : 'quantidade'
    formRef.current?.querySelector<HTMLElement>(`[name="${alvo}"], #${alvo}`)?.focus()
  }, [estado, tipo])

  /** Erro de validação leva o foco ao campo errado — teclado não pode ficar perdido. */
  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  function trocarTipo(novo: TipoEstoque) {
    setTipo(novo)
    // Fora da compra não existe fornecedor nem título; manter o que foi
    // escolhido faria o servidor recusar por um campo que a tela nem mostra.
    if (!REGRA[novo].temFornecedor) {
      setFornecedorId('')
      setGerarTitulo(false)
    }
  }

  if (produtos.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">Nenhum produto controla estoque</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          O movimento de estoque precisa de um produto ativo com &ldquo;controla estoque&rdquo;
          marcado no cadastro.
        </p>
        <Button asChild variant="primario" className="mt-4">
          <Link href="/cadastro/produtos">Ir para Produtos</Link>
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {estado.sucesso && <Recibo sucesso={estado.sucesso} />}

      <form
        key={estado.tentativa ?? 0}
        ref={formRef}
        action={enviar}
        onSubmit={() => {
          // Abre a janela: o que ela mexer daqui em diante é do próximo
          // lançamento, e a limpeza não pode levar junto.
          mexeuDesdeOEnvio.current = false
        }}
        className="space-y-4"
        noValidate
      >
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="sentido" value={sentido} />
        {ehAjuste && <input type="hidden" name="quantidade" value={qtdLancada || ''} />}

        {estado.erro && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{estado.erro}</span>
          </div>
        )}

        <Secao
          titulo="O que aconteceu com a mercadoria?"
          descricao="O tipo decide o sentido do lançamento e o que ele significa no resultado do mês."
        >
          <fieldset>
            <legend className="sr-only">Tipo do movimento</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {TIPOS_EM_ORDEM.map((t) => {
                const r = REGRA[t]
                const ativo = t === tipo
                return (
                  <label
                    key={t}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco',
                      ativo
                        ? 'border-acento-suave-borda bg-acento-suave font-medium text-acento-texto'
                        : 'border-borda-controle bg-superficie text-texto hover:bg-superficie-hover',
                    )}
                  >
                    <input
                      type="radio"
                      name="tipoEscolha"
                      value={t}
                      checked={ativo}
                      onChange={() => {
                        registrarToque()
                        trocarTipo(t)
                      }}
                      className="sr-only"
                    />
                    {/* O escolhido não pode se distinguir só pela cor: com o anel
                        de foco por cima o preenchimento fica difícil de ler, e
                        escolher o tipo errado é a falha que esta tela existe
                        para impedir. Espaço reservado nos dois estados para o
                        texto não pular ao trocar. */}
                    <Check className={cn('size-4 shrink-0', !ativo && 'invisible')} aria-hidden />
                    <span className="flex-1">{r.rotulo}</span>
                    {r.perda && (
                      <Badge variant="perigo" className="shrink-0">
                        custo
                      </Badge>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <p className="mt-3 text-sm text-texto-suave">{regra.ajuda}</p>

          {regra.perda && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-info-bg px-3 py-2.5 text-sm text-info">
              <Receipt className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-0.5">
                <p className="font-medium">Isto não é uma venda.</p>
                <p>
                  Nenhuma receita é gerada e nada entra no caixa. A mercadoria sai do estoque e
                  vira custo do mês
                  {valorTotal > 0 && (
                    <>
                      {' '}
                      — <strong className="tabular-nums">{moeda(valorTotal)}</strong> por este
                      lançamento
                    </>
                  )}
                  .
                </p>
              </div>
            </div>
          )}

          {ehAjuste && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-alerta-bg px-3 py-2.5 text-sm text-alerta">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Ajuste é para quando a contagem física não bate com o sistema. Se o erro foi de
                digitação, o certo é{' '}
                <Link href="/estoque/entradas" className="underline underline-offset-2">
                  estornar o lançamento errado
                </Link>{' '}
                — assim o extrato continua dizendo o que aconteceu de verdade.
              </span>
            </div>
          )}
        </Secao>

        <Secao titulo="Lançamento">
          <div className="grid gap-4 sm:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="produtoId">Produto</Label>
              <Select
                id="produtoId"
                name="produtoId"
                value={produtoId}
                onChange={(e) => {
                  registrarToque()
                  setProdutoId(e.target.value)
                }}
                erro={erroDe('produtoId')}
              >
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
              {produto && (
                <p
                  className={cn(
                    'text-xs tabular-nums',
                    saldoAtual < 0 ? 'text-perigo' : 'text-texto-suave',
                  )}
                >
                  {fmtQtd(saldoAtual)} {produto.unidade} em estoque · custo médio{' '}
                  {moeda(produto.custoSugerido)}
                </p>
              )}
            </div>

            {ehAjuste ? (
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="contagem">Quantidade contada no depósito</Label>
                <Input
                  id="contagem"
                  name="contagem"
                  value={contagem}
                  onChange={(e) => {
                    registrarToque()
                    setContagem(e.target.value)
                  }}
                  erro={erroDe('quantidade')}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={fmtQtd(saldoAtual)}
                  className="text-center text-lg font-semibold tabular-nums"
                />
                <p className="text-xs tabular-nums text-texto-suave">
                  {contagem === ''
                    ? 'Digite o que você contou — a diferença é calculada aqui.'
                    : diferenca === 0
                      ? 'A contagem bate com o sistema. Nada a lançar.'
                      : `Lançamento: ${diferenca > 0 ? '+' : '−'}${fmtQtd(Math.abs(diferenca))} ${produto?.unidade ?? ''}`}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="quantidade">Quantidade</Label>
                {/* Passo de mais/menos ao lado do campo: no celular acertar um
                    número pequeno no teclado numérico é mais lento que tocar
                    duas vezes. */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secundario"
                    size="icone"
                    onClick={() => {
                      registrarToque()
                      setQuantidade(String(Math.max(1, Math.round(qtdDigitada) - 1)))
                    }}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus aria-hidden />
                  </Button>
                  <Input
                    id="quantidade"
                    name="quantidade"
                    value={quantidade}
                    onChange={(e) => {
                      registrarToque()
                      setQuantidade(e.target.value)
                    }}
                    erro={erroDe('quantidade')}
                    inputMode="decimal"
                    autoComplete="off"
                    className="text-center text-lg font-semibold tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="secundario"
                    size="icone"
                    onClick={() => {
                      registrarToque()
                      setQuantidade(String(Math.min(999999, Math.round(qtdDigitada) + 1)))
                    }}
                    aria-label="Aumentar quantidade"
                  >
                    <Plus aria-hidden />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="custoUnitario">
                Custo unitário
                {!regra.temFornecedor && (
                  <span className="ml-1 font-normal text-texto-fraco">
                    (deixe como está se não souber)
                  </span>
                )}
              </Label>
              <Input
                id="custoUnitario"
                name="custoUnitario"
                value={custo}
                onChange={(e) => {
                  registrarToque()
                  setCusto(e.target.value)
                }}
                erro={erroDe('custoUnitario')}
                inputMode="decimal"
                autoComplete="off"
                placeholder={produto ? produto.custoSugerido.toFixed(2).replace('.', ',') : '0,00'}
                className="tabular-nums"
              />
              <p className="text-xs tabular-nums text-texto-suave">
                {qtdLancada > 0 && custoEfetivo > 0
                  ? `Total do lançamento: ${moeda(valorTotal)}`
                  : 'Em branco, entra pelo custo médio que o produto já tem.'}
              </p>
            </div>

            {/* A conferência que evita o saldo descoberto meses depois: ela vê
                onde o estoque vai parar antes de gravar, não depois. */}
            <div className="sm:col-span-3">
              <div className="flex h-full items-center gap-3 rounded-md bg-superficie-afundada px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-texto-suave">Saldo depois deste lançamento</p>
                  <p
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      saldoDepois < 0 ? 'text-perigo' : 'text-texto',
                    )}
                  >
                    {fmtQtd(saldoDepois)} {produto?.unidade ?? ''}
                  </p>
                </div>
                {saldoDepois < 0 && (
                  <span className="text-xs text-perigo">
                    Vai ficar negativo — falta lançar entrada.
                  </span>
                )}
              </div>
            </div>

            {regra.temFornecedor && (
              <>
                <div className="space-y-1.5 sm:col-span-4">
                  <Label htmlFor="fornecedorId">
                    Fornecedor
                    <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
                  </Label>
                  <Select
                    id="fornecedorId"
                    name="fornecedorId"
                    value={fornecedorId}
                    onChange={(e) => {
                      registrarToque()
                      setFornecedorId(e.target.value)
                    }}
                    erro={erroDe('fornecedorId')}
                  >
                    <option value="">Sem fornecedor cadastrado</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="documento">
                    Nota
                    <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
                  </Label>
                  <Input
                    id="documento"
                    name="documento"
                    defaultValue={estado.valores?.documento ?? ''}
                    erro={erroDe('documento')}
                    maxLength={40}
                    autoComplete="off"
                    placeholder="12345"
                  />
                </div>

                <div className="space-y-3 sm:col-span-6">
                  <label
                    className={cn(
                      'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                      'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco',
                      gerarTitulo
                        ? 'border-acento-suave-borda bg-acento-suave text-acento-texto'
                        : 'border-borda-controle bg-superficie text-texto hover:bg-superficie-hover',
                    )}
                  >
                    <input
                      type="checkbox"
                      name="gerarContaPagar"
                      checked={gerarTitulo}
                      onChange={(e) => {
                        registrarToque()
                        setGerarTitulo(e.target.checked)
                      }}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--acento)]"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-medium">Gerar título em Contas a Pagar</span>
                      <span className="block text-xs text-texto-suave">
                        A mercadoria entra e a dívida nasce no mesmo lançamento
                        {valorTotal > 0 && <> — {moeda(valorTotal)}</>}. Marque quando a compra
                        for a prazo.
                      </span>
                    </span>
                  </label>

                  {gerarTitulo && (
                    <div className="space-y-1.5 sm:max-w-56">
                      <Label htmlFor="vencimento">Vencimento</Label>
                      <Input
                        id="vencimento"
                        name="vencimento"
                        type="date"
                        defaultValue={estado.valores?.vencimento || vencimentoSugerido}
                        erro={erroDe('vencimento')}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1.5 sm:col-span-6">
              <Label htmlFor="observacao">
                Observação
                <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
              </Label>
              <Textarea
                id="observacao"
                name="observacao"
                defaultValue={estado.valores?.observacao ?? ''}
                erro={erroDe('observacao')}
                rows={2}
                maxLength={300}
                placeholder={
                  ehAjuste
                    ? 'Contagem do dia 01, feita com o Beto'
                    : 'Envase do turno da manhã'
                }
              />
            </div>
          </div>
        </Secao>

        <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
          {ajusteSemContagem && (
            <p className="mr-auto text-xs text-texto-suave">
              {contagem === '' ? 'Informe a contagem para lançar.' : 'Nada a ajustar.'}
            </p>
          )}
          <BotaoLancar bloqueado={ajusteSemContagem} />
        </div>
      </form>
    </div>
  )
}

/** O comprovante que fica na tela — ela confere o saldo antes de lançar o próximo. */
function Recibo({ sucesso }: { sucesso: NonNullable<EstadoFormularioMovimento['sucesso']> }) {
  const regra = REGRA[sucesso.tipo]
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-sucesso-bg bg-sucesso-bg px-4 py-3 text-sm text-sucesso"
    >
      <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium">
          {regra.rotulo}: {fmtQtd(sucesso.quantidade)} {sucesso.unidade} de {sucesso.produto}
        </p>
        <p className="tabular-nums">
          Saldo agora: {fmtQtd(sucesso.saldo)} {sucesso.unidade} · custo médio{' '}
          {moeda(sucesso.custoMedio)}
        </p>
        {sucesso.tituloGerado && (
          <p className="tabular-nums">
            Título de {moeda(sucesso.tituloGerado.valor)} criado em{' '}
            <Link href="/financeiro/pagar" className="underline underline-offset-2">
              Contas a Pagar
            </Link>
            .
          </p>
        )}
        {regra.perda && <p>Registrado como custo. Nenhuma receita foi gerada.</p>}
      </div>
    </div>
  )
}
