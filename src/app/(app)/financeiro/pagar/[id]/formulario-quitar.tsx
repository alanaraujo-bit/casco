'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Banknote, Check, CircleAlert, TriangleAlert, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { moeda } from '@/lib/utils'
import { centavos, deCentavos, paraNumero } from '@/modules/vendas/esquema'
import { desfazerPagamento } from '@/modules/financeiro/acoes'
import type { EstadoQuitar } from '@/modules/financeiro/esquema'
import type {
  ContaOpcao,
  ContaPagarDetalhe,
  FormaPagamentoOpcao,
} from '@/modules/financeiro/consultas'

type Props = {
  acao: (anterior: EstadoQuitar, form: FormData) => Promise<EstadoQuitar>
  conta: ContaPagarDetalhe
  contas: ContaOpcao[]
  formas: FormaPagamentoOpcao[]
  hoje: string
}

function BotaoPagar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Pagando…'
      ) : (
        <>
          <Banknote aria-hidden />
          Confirmar pagamento
        </>
      )}
    </Button>
  )
}

/**
 * O pagamento de uma conta — o espelho da baixa de título.
 *
 * Mesma forma, mesmos padrões, sentido oposto: hoje, o valor previsto, o caixa
 * da loja, dinheiro. Manter as duas telas parecidas não é economia de código
 * (elas são arquivos separados) — é para a operadora não precisar aprender duas
 * vezes a mesma operação.
 */
export function FormularioQuitar({ acao, conta, contas, formas, hoje }: Props) {
  const [estado, enviar] = useActionState<EstadoQuitar, FormData>(acao, {})

  // Os padrões relêem `estado.valores` pelo mesmo motivo da baixa de título: o
  // React 19 limpa o formulário quando a action termina, inclusive em erro.
  const [pagoEm, setPagoEm] = useState(estado.valores?.pagoEm || hoje)
  const [valorPago, setValorPago] = useState(
    estado.valores?.valorPago || Number(conta.valorPrevisto).toFixed(2).replace('.', ','),
  )
  const [contaId, setContaId] = useState(
    estado.valores?.contaId || contas.find((c) => c.tipo === 'caixa')?.id || contas[0]?.id || '',
  )
  const [formaId, setFormaId] = useState(
    estado.valores?.formaId ||
      formas.find((f) => f.tipo === 'dinheiro')?.id ||
      formas[0]?.id ||
      '',
  )

  const formRef = useRef<HTMLFormElement>(null)
  const pago = centavos(paraNumero(valorPago) || 0)
  const previsto = centavos(Number(conta.valorPrevisto))
  const diferenca = previsto - pago

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus()
  }, [estado])

  if (estado.sucesso) {
    const s = estado.sucesso
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3 text-sucesso">
          <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-base font-medium">
              Pago: <span className="tabular-nums">{moeda(s.valorPago)}</span> — {s.descricao}
            </p>
            <p className="text-sm">Saiu de {s.conta}.</p>
            {s.diferenca !== 0 && (
              <p className="text-sm text-alerta">
                {s.diferenca > 0
                  ? `${moeda(s.diferenca)} a menos que o previsto.`
                  : `${moeda(-s.diferenca)} a mais que o previsto.`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="primario">
            <Link href="/financeiro/pagar">Voltar para Contas a Pagar</Link>
          </Button>
          <Button asChild variant="secundario">
            <Link href="/financeiro/caixa">Ver no Caixa</Link>
          </Button>
        </div>
      </Card>
    )
  }

  if (conta.pagoEm) return <JaPago conta={conta} />

  if (contas.length === 0 || formas.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">
          Falta cadastrar {contas.length === 0 ? 'uma conta' : 'uma forma de pagamento'}
        </p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          Sem isso não há de onde o dinheiro sair — e um pagamento sem origem é o que impede o
          caixa de fechar.
        </p>
      </Card>
    )
  }

  return (
    <form
      key={estado.tentativa ?? 0}
      ref={formRef}
      action={enviar}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="contaPagarId" value={conta.id} />

      {estado.erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pagoEm">Data do pagamento</Label>
            <Input
              id="pagoEm"
              name="pagoEm"
              type="date"
              value={pagoEm}
              onChange={(e) => setPagoEm(e.target.value)}
              erro={estado.campos?.pagoEm}
            />
            <p className="text-xs text-texto-fraco">A saída de caixa entra nesta data.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valorPago">Valor pago</Label>
            <Input
              id="valorPago"
              name="valorPago"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              erro={estado.campos?.valorPago}
              inputMode="decimal"
              autoComplete="off"
              className="text-right tabular-nums"
            />
            {diferenca !== 0 && (
              <p className="text-xs text-alerta tabular-nums">
                {diferenca > 0
                  ? `${moeda(deCentavos(diferenca))} a menos que o previsto.`
                  : `${moeda(deCentavos(-diferenca))} a mais que o previsto.`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="formaId">Forma de pagamento</Label>
            <Select
              id="formaId"
              name="formaId"
              value={formaId}
              onChange={(e) => setFormaId(e.target.value)}
              erro={estado.campos?.formaId}
            >
              {formas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contaId">Sai de</Label>
            <Select
              id="contaId"
              name="contaId"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              erro={estado.campos?.contaId}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <BotaoPagar />
        <Button asChild variant="fantasma">
          <Link href="/financeiro/pagar">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}

/** A conta já paga, com o caminho de volta. */
function JaPago({ conta }: { conta: ContaPagarDetalhe }) {
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function desfazer() {
    setPendente(true)
    setErro(null)
    const r = await desfazerPagamento(conta.id)
    setPendente(false)
    if (!r.ok) setErro(r.erro ?? 'Não foi possível desfazer.')
    else setConfirmando(false)
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3 text-sucesso">
        <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-base font-medium">
            Pago em {conta.pagoEm} —{' '}
            <span className="tabular-nums">{moeda(Number(conta.valorPago ?? 0))}</span>
          </p>
          <p className="text-sm">
            {conta.forma ?? 'sem forma registrada'} · saiu de{' '}
            {conta.conta ?? 'conta não registrada'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
        <Button asChild variant="primario">
          <Link href="/financeiro/pagar">Voltar para Contas a Pagar</Link>
        </Button>

        {!confirmando ? (
          <Button variant="fantasma" onClick={() => setConfirmando(true)}>
            <Undo2 aria-hidden />
            Desfazer pagamento
          </Button>
        ) : (
          <>
            <Button variant="perigo" onClick={desfazer} disabled={pendente}>
              {pendente ? 'Desfazendo…' : 'Confirmar: conta volta a ficar em aberto'}
            </Button>
            <Button variant="fantasma" onClick={() => setConfirmando(false)} disabled={pendente}>
              Cancelar
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-texto-fraco">
        Desfazer não apaga a saída de caixa: lança a entrada oposta, para o extrato continuar
        explicando o que aconteceu.
      </p>

      {erro && (
        <p role="alert" className="text-sm text-perigo">
          {erro}
        </p>
      )}
    </Card>
  )
}
