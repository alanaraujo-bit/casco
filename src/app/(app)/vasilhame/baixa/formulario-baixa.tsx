'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  ArrowLeftRight,
  Check,
  CircleAlert,
  Minus,
  Plus,
  Receipt,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  MOTIVOS_EM_ORDEM,
  REGRA,
  type EstadoFormularioMovimento,
} from '@/modules/vasilhame/esquema'
import type { ClienteOpcao, VasilhameOpcao } from '@/modules/vasilhame/consultas'
import type { MotivoVasilhame } from '@/db/schema'

type Props = {
  acao: (
    anterior: EstadoFormularioMovimento,
    form: FormData,
  ) => Promise<EstadoFormularioMovimento>
  vasilhames: VasilhameOpcao[]
  clientes: ClienteOpcao[]
  /** Saldos diferentes de zero, para mostrar o que o cliente já deve antes de gravar. */
  saldos: { clienteId: string; produtoId: string; quantidade: number }[]
}

function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

function BotaoLancar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      disabled={pending}
      aria-disabled={pending}
      className="w-full sm:w-auto"
    >
      {pending ? (
        'Lançando…'
      ) : (
        <>
          <ArrowLeftRight aria-hidden />
          Lançar baixa
        </>
      )}
    </Button>
  )
}

/**
 * A tela que existe no lugar da venda de R$ 0,13.
 *
 * Duas decisões guiam tudo aqui:
 *
 * **A operadora nunca digita sinal.** Ela escolhe o motivo e digita quantos
 * galões, sempre positivo. O sinal sai de `aplicarSinal()`, no servidor. Um
 * campo que aceita negativo seria uma forma silenciosa de inverter um saldo.
 *
 * **O motivo vem primeiro, e como botão.** Não é um `<select>` no meio do
 * formulário porque a escolha do motivo *é* a tela: é o campo que não existe no
 * sistema antigo e cuja falta produziu o problema. Escolhido o motivo, o resto
 * do formulário se ajusta — cliente aparece ou some, o aviso de custo aparece.
 */
export function FormularioBaixa({ acao, vasilhames, clientes, saldos }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioMovimento, FormData>(acao, {})

  const [motivo, setMotivo] = useState<MotivoVasilhame>('devolvido')
  const [produtoId, setProdutoId] = useState(vasilhames[0]?.id ?? '')
  const [clienteId, setClienteId] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [sentido, setSentido] = useState<'saida' | 'entrada'>('entrada')

  const formRef = useRef<HTMLFormElement>(null)
  const regra = REGRA[motivo]

  /**
   * A operadora mexeu em alguma coisa desde que apertou "Lançar"?
   *
   * A limpeza abaixo só chega quando a action responde, e entre o clique e a
   * resposta a tela continua viva — com a fila do balcão andando, ela já
   * escolheu o próximo cliente e digitou a quantidade. Limpar nesse instante
   * apaga o que ela acabou de escrever, e sem erro nenhum na tela: o cliente
   * simplesmente volta a "Escolha o cliente…" e o número volta para 1. Ela
   * relança achando que não gravou, e o saldo do primeiro cliente sai dobrado.
   *
   * `ref` e não `state` de propósito: isto não desenha nada, e como `state`
   * provocaria um render a cada tecla digitada.
   */
  const mexeuDesdeOEnvio = useRef(false)
  const registrarToque = () => {
    mexeuDesdeOEnvio.current = true
  }

  const chaveSaldo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const s of saldos) mapa.set(`${s.clienteId}:${s.produtoId}`, s.quantidade)
    return mapa
  }, [saldos])

  const vasilhame = vasilhames.find((v) => v.id === produtoId)
  const cliente = clientes.find((c) => c.id === clienteId)
  const saldoAtual = clienteId && produtoId ? (chaveSaldo.get(`${clienteId}:${produtoId}`) ?? 0) : null

  const qtd = Number(quantidade.replace(/\D/g, '')) || 0
  const custoUnitario = Number(vasilhame?.custo ?? 0)
  const custoTotal = custoUnitario * qtd

  const erroDe = (campo: keyof NonNullable<EstadoFormularioMovimento['campos']>) =>
    estado.campos?.[campo]

  /**
   * Depois de gravar, o formulário fica pronto para o próximo lançamento — mas
   * não zerado. Motivo e vasilhame ficam, porque na prática ela lança dez
   * devoluções do mesmo galão em sequência; cliente e quantidade limpam,
   * porque o próximo é outra pessoa e outro número. Zerar tudo obrigaria a
   * refazer duas escolhas idênticas a cada cliente da fila.
   *
   * Ajustado em render e não num efeito: um `setState` dentro de `useEffect`
   * pinta a tela uma vez com o cliente antigo ainda selecionado antes de
   * limpar. É o piscada que o `AGENTS.md` proíbe, e aqui ela cairia bem no
   * momento em que a operadora olha para conferir o que gravou.
   */
  const [ultimoLancado, setUltimoLancado] = useState(0)
  if (estado.sucesso && estado.tentativa !== ultimoLancado) {
    setUltimoLancado(estado.tentativa ?? 0)
    // Só limpa o que ela não voltou a tocar. Ver `mexeuDesdeOEnvio` acima.
    if (!mexeuDesdeOEnvio.current) {
      setClienteId('')
      setQuantidade('1')
    }
  }

  /** O foco volta para onde o próximo lançamento começa. */
  useEffect(() => {
    if (!estado.sucesso) return
    const alvo = REGRA[estado.sucesso.motivo].cliente === 'proibido' ? 'quantidade' : 'clienteId'
    formRef.current?.querySelector<HTMLElement>(`[name="${alvo}"]`)?.focus()
  }, [estado])

  /** Erro de validação leva o foco ao campo errado — teclado não pode ficar perdido. */
  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  function trocarMotivo(novo: MotivoVasilhame) {
    setMotivo(novo)
    // Motivo de fábrica não aceita cliente. Manter o cliente escolhido faria o
    // servidor recusar por um campo que a tela nem mostra mais.
    if (REGRA[novo].cliente === 'proibido') setClienteId('')
  }

  if (vasilhames.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">Nenhum vasilhame configurado</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          O controle de comodato precisa saber qual produto é o galão vazio. No cadastro do
          produto retornável, escolha o vasilhame correspondente.
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
          // Abre a janela: o que ela mexer daqui em diante é da próxima baixa,
          // e a limpeza não pode levar junto.
          mexeuDesdeOEnvio.current = false
        }}
        className="space-y-4"
        noValidate
      >
        <input type="hidden" name="motivo" value={motivo} />
        <input type="hidden" name="sentido" value={sentido} />

        <AvisoErro erro={estado.erro} />

        <Secao
          titulo="O que aconteceu com o galão?"
          // A descrição diz o que o campo faz, e não com o que ele se compara:
          // o Casco é vendido para distribuidoras que nunca usaram outro
          // sistema, e para elas uma frase sobre "o sistema antigo" não
          // significa nada. O que ajuda é saber o que o motivo determina.
          descricao="O motivo define o resto: se o saldo do cliente sobe ou desce, e se o galão vira custo."
        >
          <fieldset>
            <legend className="sr-only">Motivo da baixa</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MOTIVOS_EM_ORDEM.map((m) => {
                const r = REGRA[m]
                const ativo = m === motivo
                return (
                  <label
                    key={m}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco',
                      ativo
                        ? 'border-acento-suave-borda bg-acento-suave text-acento-texto font-medium'
                        : 'border-borda-controle bg-superficie text-texto hover:bg-superficie-hover',
                    )}
                  >
                    <input
                      type="radio"
                      name="motivoEscolha"
                      value={m}
                      checked={ativo}
                      onChange={() => {
                        registrarToque()
                        trocarMotivo(m)
                      }}
                      className="sr-only"
                    />
                    {/* O escolhido não pode se distinguir só pela cor. Com o
                        anel de foco por cima, o preenchimento fica difícil de
                        ler mesmo com visão de cores normal — e escolher o
                        motivo errado é exatamente a falha que esta tela existe
                        para impedir. O espaço é reservado nos dois estados
                        para o texto não pular ao trocar de motivo. */}
                    <Check
                      className={cn('size-4 shrink-0', !ativo && 'invisible')}
                      aria-hidden
                    />
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
            /**
             * O painel que explica a troca de sistema, no momento exato em que
             * ela importa. A operadora está fazendo aqui o que antes exigia
             * inventar uma venda de centavos — e precisa ver, na hora, que o
             * faturamento do dia não muda por causa disto.
             */
            <div className="mt-3 flex items-start gap-2 rounded-md bg-info-bg px-3 py-2.5 text-sm text-info">
              <Receipt className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-0.5">
                <p className="font-medium">Isto não é uma venda.</p>
                <p>
                  Nenhuma receita é gerada e nada entra no caixa. O galão sai do patrimônio e
                  vira custo do mês
                  {custoTotal > 0 && (
                    <>
                      {' '}
                      — <strong className="tabular-nums">{moeda(custoTotal)}</strong> por este
                      lançamento
                    </>
                  )}
                  .
                </p>
              </div>
            </div>
          )}

          {regra.perda && custoUnitario === 0 && vasilhame && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-alerta-bg px-3 py-2.5 text-sm text-alerta">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>{vasilhame.nome}</strong> está com custo R$ 0,00 no cadastro. A perda
                será registrada, mas sem custo — e o resultado do mês vai mostrar perda de
                graça.{' '}
                <Link href="/cadastro/produtos" className="underline underline-offset-2">
                  Definir o custo
                </Link>
                .
              </span>
            </div>
          )}
        </Secao>

        <Secao titulo="Lançamento">
          <div className="grid gap-4 sm:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="produtoId">Vasilhame</Label>
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
                {vasilhames.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Select>
              {vasilhame && (
                <p className="text-xs text-texto-suave tabular-nums">
                  {vasilhame.naRua.toLocaleString('pt-BR')} na rua · custo{' '}
                  {moeda(custoUnitario)}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="quantidade">Quantidade</Label>
              {/* Passo de mais/menos ao lado do campo: no balcão a quantidade é
                  quase sempre 1 ou 2, e no celular acertar um número pequeno no
                  teclado numérico é mais lento que tocar duas vezes. */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secundario"
                  size="icone"
                  onClick={() => {
                    registrarToque()
                    setQuantidade(String(Math.max(1, qtd - 1)))
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
                    setQuantidade(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }}
                  erro={erroDe('quantidade')}
                  inputMode="numeric"
                  autoComplete="off"
                  className="text-center text-lg font-semibold tabular-nums"
                />
                <Button
                  type="button"
                  variant="secundario"
                  size="icone"
                  onClick={() => {
                    registrarToque()
                    setQuantidade(String(Math.min(9999, qtd + 1)))
                  }}
                  aria-label="Aumentar quantidade"
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </div>

            {regra.cliente !== 'proibido' && (
              <div className="space-y-1.5 sm:col-span-4">
                <Label htmlFor="clienteId">
                  Cliente
                  {regra.cliente === 'opcional' && (
                    <span className="ml-1 font-normal text-texto-fraco">
                      (opcional — vazio significa que quebrou no depósito)
                    </span>
                  )}
                </Label>
                <Select
                  id="clienteId"
                  name="clienteId"
                  value={clienteId}
                  onChange={(e) => {
                    registrarToque()
                    setClienteId(e.target.value)
                  }}
                  erro={erroDe('clienteId')}
                >
                  <option value="">
                    {regra.cliente === 'obrigatorio' ? 'Escolha o cliente…' : 'Nenhum — foi aqui dentro'}
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo ? `${String(c.codigo).padStart(4, '0')} - ` : ''}
                      {c.nome}
                    </option>
                  ))}
                </Select>

                {/* A conferência que evita o saldo negativo descoberto meses
                    depois: ele diz que está devolvendo 5, a tela diz que ele
                    tem 3. A pergunta é feita agora, com o cliente na frente. */}
                {cliente && saldoAtual !== null && (
                  <p
                    className={cn(
                      'text-xs tabular-nums',
                      saldoAtual < 0 ? 'text-alerta' : 'text-texto-suave',
                    )}
                  >
                    {saldoAtual > 0
                      ? `${cliente.nome} está com ${saldoAtual} ${vasilhame?.nome ?? 'vasilhame'} hoje.`
                      : saldoAtual === 0
                        ? `${cliente.nome} não está devendo este vasilhame.`
                        : `Atenção: saldo negativo de ${Math.abs(saldoAtual)} — devolveu mais do que levou.`}
                  </p>
                )}
              </div>
            )}

            {regra.direcao === 'ambas' && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sentidoEscolha">Sentido do ajuste</Label>
                <Select
                  id="sentidoEscolha"
                  name="sentidoEscolha"
                  value={sentido}
                  onChange={(e) => {
                    registrarToque()
                    setSentido(e.target.value === 'saida' ? 'saida' : 'entrada')
                  }}
                >
                  <option value="entrada">Encontrou galão a mais</option>
                  <option value="saida">Faltou galão na contagem</option>
                </Select>
              </div>
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
                placeholder="Quebrou na descarga do caminhão"
              />
            </div>
          </div>
        </Secao>

        <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
          <BotaoLancar />
        </div>
      </form>
    </div>
  )
}

/** O comprovante que fica na tela — a operadora repete o saldo para o cliente antes dele sair. */
function Recibo({ sucesso }: { sucesso: NonNullable<EstadoFormularioMovimento['sucesso']> }) {
  const regra = REGRA[sucesso.motivo]
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-sucesso-bg bg-sucesso-bg px-4 py-3 text-sm text-sucesso"
    >
      <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium">
          {regra.rotulo}: {sucesso.quantidade}× {sucesso.produto}
          {sucesso.cliente && ` — ${sucesso.cliente}`}
        </p>
        {sucesso.saldoCliente !== null && sucesso.cliente && (
          <p className="tabular-nums">
            {sucesso.saldoCliente > 0
              ? `${sucesso.cliente} fica com ${sucesso.saldoCliente} vasilhame(s).`
              : sucesso.saldoCliente === 0
                ? `${sucesso.cliente} está quite.`
                : `${sucesso.cliente} ficou com saldo negativo de ${Math.abs(sucesso.saldoCliente)}.`}
          </p>
        )}
        {regra.perda && <p>Registrado como custo. Nenhuma receita foi gerada.</p>}
      </div>
    </div>
  )
}
