'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { moeda } from '@/lib/utils'
import type { EstadoAberturaCaixa } from '@/modules/financeiro/esquema'
import type { ContaCaixaOpcao } from '@/modules/financeiro/consultas'

type Props = {
  acao: (anterior: EstadoAberturaCaixa, form: FormData) => Promise<EstadoAberturaCaixa>
  contas: ContaCaixaOpcao[]
}

function BotaoAbrir() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Registrando…'
      ) : (
        <>
          <Wallet aria-hidden />
          Registrar abertura
        </>
      )}
    </Button>
  )
}

export function FormularioAbertura({ acao, contas }: Props) {
  const [estado, enviar] = useActionState<EstadoAberturaCaixa, FormData>(acao, {})
  const formRef = useRef<HTMLFormElement>(null)

  const v = estado.valores ?? {}
  const erroDe = (campo: keyof NonNullable<EstadoAberturaCaixa['campos']>) =>
    estado.campos?.[campo]

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  if (contas.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-medium text-texto">Nenhuma conta do tipo Caixa cadastrada</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          Cadastre uma conta do tipo Caixa em Financeiro › Contas para registrar a abertura do
          turno.
        </p>
      </Card>
    )
  }

  if (estado.sucesso) {
    const s = estado.sucesso
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3 text-sucesso">
          <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-base font-medium">Abertura registrada em {s.conta}.</p>
            <p className="mt-1 text-sm text-texto-suave">
              {moeda(s.valorAbertura)} na gaveta
              {s.fundoTroco > 0 && `, ${moeda(s.fundoTroco)} reservados como fundo de troco`}.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <form key={estado.tentativa ?? 0} ref={formRef} action={enviar} className="space-y-4" noValidate>
      <AvisoErro erro={estado.erro} />

      <Card className="space-y-4 p-4 md:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="contaId">Caixa</Label>
          <Select
            id="contaId"
            name="contaId"
            defaultValue={v.contaId ?? (contas.length === 1 ? contas[0].id : '')}
            erro={erroDe('contaId')}
          >
            {contas.length > 1 && <option value="">Selecione…</option>}
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
              className="text-right tabular-nums"
            />
            <p className="text-xs text-texto-fraco">Tudo que está contado na gaveta agora.</p>
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observacao">
            Observação
            <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
          </Label>
          <Textarea
            id="observacao"
            name="observacao"
            defaultValue={v.observacao ?? ''}
            erro={erroDe('observacao')}
            rows={2}
            maxLength={300}
            placeholder="Turno da manhã"
          />
        </div>
      </Card>

      <BotaoAbrir />
    </form>
  )
}
