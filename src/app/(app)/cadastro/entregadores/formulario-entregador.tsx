'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarTelefone, mascararTelefone } from '@/lib/formatos'
import type { EstadoFormularioEntregador } from '@/modules/entregadores/esquema'
import type { Entregador } from '@/db/schema'

type Props = {
  acao: (
    anterior: EstadoFormularioEntregador,
    form: FormData,
  ) => Promise<EstadoFormularioEntregador>
  entregador?: Entregador
}

function Campo({
  span = 'sm:col-span-3',
  htmlFor,
  rotulo,
  opcional,
  children,
}: {
  span?: string
  htmlFor: string
  rotulo: string
  opcional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${span}`}>
      <Label htmlFor={htmlFor}>
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>}
      </Label>
      {children}
    </div>
  )
}

function BotaoSalvar({ novo }: { novo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          {novo ? 'Cadastrar entregador' : 'Salvar alterações'}
        </>
      )}
    </Button>
  )
}

export function FormularioEntregador({ acao, entregador }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioEntregador, FormData>(acao, {})
  const novo = !entregador
  const erroDe = (campo: keyof NonNullable<EstadoFormularioEntregador['campos']>) =>
    estado.campos?.[campo]

  const formRef = useRef<HTMLFormElement>(null)

  const valor = (campo: keyof NonNullable<EstadoFormularioEntregador['valores']>, doBanco = '') =>
    estado.valores?.[campo] ?? doBanco

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  return (
    <form
      key={estado.tentativa ?? 0}
      ref={formRef}
      action={enviar}
      className="space-y-4"
      noValidate
    >
      <AvisoErro erro={estado.erro} />

      <Card className="space-y-4 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-6">
          <Campo span="sm:col-span-6" htmlFor="nome" rotulo="Nome">
            <Input
              id="nome"
              name="nome"
              defaultValue={valor('nome', entregador?.nome ?? '')}
              erro={erroDe('nome')}
              autoFocus={novo}
              autoComplete="off"
              maxLength={120}
              placeholder="José da Entrega"
            />
          </Campo>

          <Campo span="sm:col-span-3" htmlFor="telefone" rotulo="Telefone" opcional>
            <Input
              id="telefone"
              name="telefone"
              defaultValue={valor('telefone', formatarTelefone(entregador?.telefone))}
              erro={erroDe('telefone')}
              inputMode="tel"
              autoComplete="off"
              placeholder="(94) 98100-0000"
              onInput={(e) => {
                e.currentTarget.value = mascararTelefone(e.currentTarget.value)
              }}
            />
          </Campo>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
        <Button asChild variant="secundario">
          <Link href="/cadastro/entregadores">Cancelar</Link>
        </Button>
        <BotaoSalvar novo={novo} />
      </div>
    </form>
  )
}
