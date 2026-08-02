'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Check, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { EstadoConta } from '@/modules/financeiro/esquema'

type Props = {
  acao: (anterior: EstadoConta, form: FormData) => Promise<EstadoConta>
  /** Vazio cria; preenchido edita. */
  id?: string
  inicial?: { nome: string; tipo: string; saldoInicial: string }
}

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          Salvar conta
        </>
      )}
    </Button>
  )
}

/**
 * Cadastro de uma conta bancária.
 *
 * **Caixa e banco vêm primeiro, e como botão**, pelo mesmo motivo que custo e
 * despesa vêm primeiro em Contas a Pagar: é a escolha da qual o resto depende
 * para significar alguma coisa. Sangria e suprimento só existem num caixa
 * físico, e o fechamento do dia pergunta sobre a gaveta — não sobre o
 * consolidado.
 */
export function FormularioConta({ acao, id, inicial }: Props) {
  const [estado, enviar] = useActionState<EstadoConta, FormData>(acao, {})
  const formRef = useRef<HTMLFormElement>(null)

  const v = estado.valores ?? {}
  const erroDe = (campo: keyof NonNullable<EstadoConta['campos']>) => estado.campos?.[campo]

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  if (estado.sucesso) {
    const s = estado.sucesso
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3 text-sucesso">
          <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-base font-medium">
            {s.nome} {s.novo ? 'foi cadastrada.' : 'foi atualizada.'}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="primario">
            <Link href="/financeiro/contas">Ver contas e formas</Link>
          </Button>
          {s.novo && (
            <Button asChild variant="secundario">
              <Link href="/financeiro/contas/nova">Cadastrar outra</Link>
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    // `key` na tentativa: o React 19 limpa o formulário quando a action termina,
    // inclusive em erro. Sem remontar com os valores devolvidos, o que foi
    // digitado some por causa de um dígito.
    <form key={estado.tentativa ?? 0} ref={formRef} action={enviar} className="space-y-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      <AvisoErro erro={estado.erro} />

      <Card className="p-4 md:p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-texto">Que tipo de conta é esta?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['caixa', 'Caixa', 'A gaveta do balcão, em dinheiro'],
                ['banco', 'Banco', 'Conta corrente, poupança ou maquininha'],
              ] as const
            ).map(([valor, rotulo, ajuda]) => (
              <label
                key={valor}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco',
                  'border-borda-controle bg-superficie hover:bg-superficie-hover',
                  'has-[:checked]:border-acento-suave-borda has-[:checked]:bg-acento-suave has-[:checked]:text-acento-texto',
                )}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={valor}
                  defaultChecked={(v.tipo || inicial?.tipo || 'banco') === valor}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{rotulo}</span>
                  <span className="block text-xs opacity-80">{ajuda}</span>
                </span>
              </label>
            ))}
          </div>
          {erroDe('tipo') && <p className="mt-1 text-xs text-perigo">{erroDe('tipo')}</p>}
        </fieldset>
      </Card>

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="nome">Nome da conta</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={v.nome ?? inicial?.nome ?? ''}
              erro={erroDe('nome')}
              maxLength={80}
              placeholder="Banco do Brasil — conta corrente"
              autoComplete="off"
            />
            <p className="text-xs text-texto-fraco">
              É o que aparece na coluna “Banco” de Contas a Receber e no extrato do Caixa.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="saldoInicial">Saldo inicial</Label>
            <Input
              id="saldoInicial"
              name="saldoInicial"
              defaultValue={v.saldoInicial ?? inicial?.saldoInicial ?? ''}
              erro={erroDe('saldoInicial')}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              className="text-right tabular-nums"
            />
            {/* O saldo continua editável depois de criada, de propósito: é assim
                que a JM lança o saldo que já existia antes do Casco, e ela vai
                descobrir o número certo depois de conferir o extrato. */}
            <p className="text-xs text-texto-fraco">
              O que já havia nesta conta antes do Casco. Aceita negativo.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <BotaoSalvar />
        <Button asChild variant="fantasma">
          <Link href="/financeiro/contas">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
