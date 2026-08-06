'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Check, Maximize, Minimize, Receipt, Wallet } from 'lucide-react'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { GlifoCasco } from '@/components/marca/glifo-casco'
import { ThemeToggle } from '@/components/theme-toggle'
import { moeda } from '@/lib/utils'
import type { EstadoAberturaCaixa } from '@/modules/financeiro/esquema'
import type { CaixaAbertoHoje, ContaCaixaOpcao, FormaPagamentoOpcao } from '@/modules/financeiro/consultas'
import type { EstadoVenda } from '@/modules/vendas/esquema'
import type {
  ClienteVenda,
  EntregadorVenda,
  PrecoTabela,
  ProdutoVenda,
} from '@/modules/vendas/consultas'
import { Pdv } from './pdv'

type Props = {
  usuario: { nome: string; empresa: string }
  caixaInicial: CaixaAbertoHoje | null
  contasCaixa: ContaCaixaOpcao[]
  acaoAbrirCaixa: (anterior: EstadoAberturaCaixa, form: FormData) => Promise<EstadoAberturaCaixa>
  acaoFecharVenda: (anterior: EstadoVenda, form: FormData) => Promise<EstadoVenda>
  produtos: ProdutoVenda[]
  precos: PrecoTabela[]
  clientes: ClienteVenda[]
  entregadores: EntregadorVenda[]
  formas: FormaPagamentoOpcao[]
  tabelaPadraoId: string | null
  companyId: string
}

/**
 * O kiosk do PDV: cabeçalho fino de "onde estou / quem sou" por cima, e
 * embaixo o portão de abertura de caixa ou a venda em si.
 *
 * **Por que o estado do caixa mora aqui, e não em cada tela separada.** O
 * portão e o PDV são a mesma sessão de balcão — abrir o caixa e cair direto
 * na venda, sem navegar para outra rota, é o que faz a aba única funcionar
 * como um caixa de supermercado de verdade: uma tela, do início ao fim do
 * turno.
 */
export function PdvKiosk({
  usuario,
  caixaInicial,
  contasCaixa,
  acaoAbrirCaixa,
  acaoFecharVenda,
  produtos,
  precos,
  clientes,
  entregadores,
  formas,
  tabelaPadraoId,
  companyId,
}: Props) {
  const [caixa, setCaixa] = useState(caixaInicial)

  return (
    <div className="flex min-h-dvh flex-col">
      <CabecalhoKiosk usuario={usuario} caixa={caixa} />

      <main className="relative min-w-0 flex-1 overflow-hidden p-3 md:p-5">
        {!caixa && <FundoPeriodoDoDia />}
        {caixa ? (
          <Pdv
            acao={acaoFecharVenda}
            produtos={produtos}
            precos={precos}
            clientes={clientes}
            entregadores={entregadores}
            formas={formas}
            tabelaPadraoId={tabelaPadraoId}
            companyId={companyId}
          />
        ) : (
          <PortaoCaixa
            acao={acaoAbrirCaixa}
            contas={contasCaixa}
            usuarioNome={usuario.nome}
            aoAbrir={(info) => setCaixa(info)}
          />
        )}
      </main>
    </div>
  )
}

type Periodo = 'manha' | 'tarde' | 'noite'

function periodoDoDia(): Periodo {
  const hora = new Date().getHours()
  if (hora >= 6 && hora < 12) return 'manha'
  if (hora >= 12 && hora < 18) return 'tarde'
  return 'noite'
}

/**
 * Um clarão suave atrás do portão de abertura de caixa, que muda com a hora
 * do relógio do balcão — manhã, tarde ou noite.
 *
 * Começa `null` (sem clarão nenhum) e só resolve o período dentro do
 * `useEffect`, depois que o React já hidratou. Fazer isso no primeiro
 * render misturaria o fuso do servidor com o fuso de quem está atrás do
 * balcão — a mesma armadilha de hidratação que os relógios de venda evitam
 * passando por `formatarHora`.
 */
function FundoPeriodoDoDia() {
  const [periodo, setPeriodo] = useState<Periodo | null>(null)

  useEffect(() => {
    const atualizar = () => setPeriodo(periodoDoDia())
    atualizar()
    const id = setInterval(atualizar, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!periodo) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-1000 [&[data-pronto]]:opacity-100"
      data-pronto
      style={{ backgroundImage: GRADIENTES_PERIODO[periodo] }}
    />
  )
}

const GRADIENTES_PERIODO: Record<Periodo, string> = {
  manha:
    'radial-gradient(120% 90% at 12% -10%, oklch(0.88 0.09 80 / 0.4), transparent 55%), ' +
    'radial-gradient(100% 80% at 100% 100%, oklch(0.8 0.08 200 / 0.2), transparent 60%)',
  tarde:
    'radial-gradient(120% 90% at 15% -10%, oklch(0.82 0.1 220 / 0.32), transparent 55%), ' +
    'radial-gradient(100% 80% at 100% 100%, oklch(0.78 0.1 200 / 0.18), transparent 60%)',
  noite:
    'radial-gradient(120% 90% at 85% -10%, oklch(0.5 0.09 265 / 0.4), transparent 55%), ' +
    'radial-gradient(100% 80% at 0% 100%, oklch(0.35 0.06 260 / 0.35), transparent 60%)',
}

/**
 * Faixa fina do topo: empresa, quem está logado, e o botão de tela cheia —
 * o que sobra de "chrome" de sistema quando a sidebar inteira sai da tela.
 * Fica fora do fluxo de impressão (o cupom não deve sair com isso no papel) e
 * some da vista quando o navegador já está em tela cheia, porque nesse ponto
 * ela só ocuparia espaço que o balcão pediu de volta.
 */
function CabecalhoKiosk({
  usuario,
  caixa,
}: {
  usuario: { nome: string; empresa: string }
  caixa: CaixaAbertoHoje | null
}) {
  const [cheia, setCheia] = useState(false)

  useEffect(() => {
    const aoMudar = () => setCheia(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', aoMudar)
    aoMudar()
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Navegador recusou (sem gesto do usuário, ou API ausente no
      // navegador embutido de algum leitor de código de barras). A tela
      // continua funcionando normalmente, só sem o modo tela cheia.
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-borda bg-superficie px-3 print:hidden md:px-5">
      <div
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-md bg-acento text-acento-contraste"
      >
        <GlifoCasco className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-texto">
          {usuario.empresa}
          <span className="ml-2 font-normal text-texto-fraco">· PDV</span>
        </p>
        <p className="truncate text-2xs text-texto-fraco">
          {usuario.nome}
          {caixa && (
            <>
              {' '}
              · caixa {caixa.contaNome} aberto com{' '}
              <span className="tabular-nums">{moeda(Number(caixa.valorAbertura))}</span>
            </>
          )}
        </p>
      </div>

      <Link
        href="/vendas/produtos"
        target="_blank"
        rel="noopener"
        className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-texto-suave hover:bg-superficie-hover hover:text-texto sm:inline-flex"
      >
        <Receipt className="size-3.5" aria-hidden />
        Ver vendas
      </Link>

      <ThemeToggle className="hidden sm:inline-flex" />

      <button
        type="button"
        onClick={alternarTelaCheia}
        aria-label={cheia ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
        title={cheia ? 'Sair da tela cheia' : 'Tela cheia'}
        className="grid size-9 shrink-0 place-items-center rounded-md text-texto-suave hover:bg-superficie-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
      >
        {cheia ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
      </button>
    </header>
  )
}

function BotaoAbrir() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      disabled={pending}
      aria-disabled={pending}
      className="w-full"
    >
      {pending ? (
        'Registrando…'
      ) : (
        <>
          <Check aria-hidden />
          Abrir caixa e começar a vender
        </>
      )}
    </Button>
  )
}

/**
 * O portão: sem abertura de caixa registrada hoje, não existe venda.
 *
 * **Por que travar aqui e não só registrar.** Um turno sem contagem inicial
 * é um turno em que ninguém sabe se o troco que sobrou no fim bate com o que
 * entrou — a pergunta só tem resposta se alguém contou a gaveta no começo. A
 * mesma pergunta que `abrirCaixa` já registra em Financeiro › Caixa, agora
 * também é a porta de entrada da venda, e não mais um registro que a
 * operadora podia esquecer de fazer.
 */
function PortaoCaixa({
  acao,
  contas,
  usuarioNome,
  aoAbrir,
}: {
  acao: (anterior: EstadoAberturaCaixa, form: FormData) => Promise<EstadoAberturaCaixa>
  contas: ContaCaixaOpcao[]
  usuarioNome: string
  aoAbrir: (caixa: CaixaAbertoHoje) => void
}) {
  const [estado, enviar] = useActionState<EstadoAberturaCaixa, FormData>(acao, {})
  const formRef = useRef<HTMLFormElement>(null)
  const tratado = useRef(0)

  // `abrirCaixa` não devolve o `id`/`abertaEm` da linha criada — só o que a
  // tela de confirmação de Financeiro precisa. Aqui completamos com o que já
  // sabemos no momento (agora, quem está logado) para acender o PDV sem
  // recarregar a página.
  useEffect(() => {
    if (!estado.sucesso || estado.tentativa === tratado.current) return
    tratado.current = estado.tentativa ?? 0
    const contaId = String(new FormData(formRef.current ?? undefined).get('contaId') ?? '')
    aoAbrir({
      aberturaId: crypto.randomUUID(),
      contaId,
      contaNome: estado.sucesso.conta,
      valorAbertura: String(estado.sucesso.valorAbertura),
      fundoTroco: String(estado.sucesso.fundoTroco),
      usuario: usuarioNome,
      abertaEm: new Date(),
    })
  }, [estado, usuarioNome, aoAbrir])

  const v = estado.valores ?? {}
  const erroDe = (campo: keyof NonNullable<EstadoAberturaCaixa['campos']>) => estado.campos?.[campo]

  if (contas.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-alerta-bg text-alerta">
          <Wallet className="size-6" aria-hidden />
        </div>
        <p className="text-base font-medium text-texto">Nenhuma conta do tipo Caixa cadastrada</p>
        <p className="max-w-[46ch] text-sm text-texto-suave">
          Cadastre uma conta do tipo Caixa em Financeiro › Contas e Formas antes de abrir o PDV.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col justify-center py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-acento-suave text-acento-texto">
          <Wallet className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-texto">Abrir o caixa</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Quanto tem na gaveta agora, {usuarioNome.split(' ')[0]}? É só uma vez por turno.
        </p>
      </div>

      <form key={estado.tentativa ?? 0} ref={formRef} action={enviar} className="space-y-4" noValidate>
        <AvisoErro erro={estado.erro} />

        <Card className="space-y-4 p-4 md:p-5">
          {contas.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="contaId">Caixa</Label>
              <Select
                id="contaId"
                name="contaId"
                defaultValue={v.contaId ?? ''}
                erro={erroDe('contaId')}
              >
                <option value="">Selecione…</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {contas.length === 1 && (
            <input type="hidden" name="contaId" value={contas[0].id} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="valorAbertura">Dinheiro na gaveta agora</Label>
            <Input
              id="valorAbertura"
              name="valorAbertura"
              defaultValue={v.valorAbertura ?? ''}
              erro={erroDe('valorAbertura')}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              autoFocus
              className="text-center text-2xl font-semibold tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fundoTroco">
              Fundo de troco
              <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
            </Label>
            <Input
              id="fundoTroco"
              name="fundoTroco"
              defaultValue={v.fundoTroco ?? ''}
              erro={erroDe('fundoTroco')}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="text-right tabular-nums"
            />
            <p className="text-xs text-texto-fraco">
              Quanto do valor acima é separado só para dar troco.
            </p>
          </div>

          <input type="hidden" name="observacao" value="" />
        </Card>

        <BotaoAbrir />
      </form>
    </div>
  )
}
