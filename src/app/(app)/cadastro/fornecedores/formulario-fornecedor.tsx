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
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  formatarDocumento,
  formatarTelefone,
  mascararDocumento,
  mascararTelefone,
  UFS,
} from '@/lib/formatos'
import type { EstadoFormularioFornecedor } from '@/modules/fornecedores/esquema'
import type { Fornecedor } from '@/db/schema'

type Props = {
  acao: (
    anterior: EstadoFormularioFornecedor,
    form: FormData,
  ) => Promise<EstadoFormularioFornecedor>
  fornecedor?: Fornecedor
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
      <div className="grid gap-4 sm:grid-cols-6">{children}</div>
    </Card>
  )
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
          {novo ? 'Cadastrar fornecedor' : 'Salvar alterações'}
        </>
      )}
    </Button>
  )
}

export function FormularioFornecedor({ acao, fornecedor }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioFornecedor, FormData>(acao, {})
  const novo = !fornecedor
  const erroDe = (campo: keyof NonNullable<EstadoFormularioFornecedor['campos']>) =>
    estado.campos?.[campo]

  const formRef = useRef<HTMLFormElement>(null)

  const valor = (campo: keyof NonNullable<EstadoFormularioFornecedor['valores']>, doBanco = '') =>
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

      <Secao
        titulo="Identificação"
        descricao="Só o nome é obrigatório — o resto pode ser completado depois."
      >
        <Campo span="sm:col-span-6" htmlFor="nome" rotulo="Nome">
          <Input
            id="nome"
            name="nome"
            defaultValue={valor('nome', fornecedor?.nome ?? '')}
            erro={erroDe('nome')}
            autoFocus={novo}
            autoComplete="off"
            maxLength={120}
            placeholder="Distribuidora de Galões Norte"
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="documento" rotulo="CPF / CNPJ" opcional>
          <Input
            id="documento"
            name="documento"
            defaultValue={valor('documento', formatarDocumento(fornecedor?.documento))}
            erro={erroDe('documento')}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0001-00"
            onInput={(e) => {
              e.currentTarget.value = mascararDocumento(e.currentTarget.value)
            }}
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="telefone" rotulo="Telefone" opcional>
          <Input
            id="telefone"
            name="telefone"
            defaultValue={valor('telefone', formatarTelefone(fornecedor?.telefone))}
            erro={erroDe('telefone')}
            inputMode="tel"
            autoComplete="off"
            placeholder="(94) 98100-0000"
            onInput={(e) => {
              e.currentTarget.value = mascararTelefone(e.currentTarget.value)
            }}
          />
        </Campo>

        <Campo span="sm:col-span-6" htmlFor="email" rotulo="E-mail" opcional>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={valor('email', fornecedor?.email ?? '')}
            erro={erroDe('email')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Campo>
      </Secao>

      <Secao titulo="Localização">
        <Campo span="sm:col-span-4" htmlFor="cidade" rotulo="Cidade" opcional>
          <Input
            id="cidade"
            name="cidade"
            defaultValue={valor('cidade', fornecedor?.cidade ?? '')}
            erro={erroDe('cidade')}
          />
        </Campo>

        <Campo span="sm:col-span-2" htmlFor="uf" rotulo="UF" opcional>
          <Select
            id="uf"
            name="uf"
            defaultValue={valor('uf', fornecedor?.uf ?? '')}
            erro={erroDe('uf')}
          >
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Campo>
      </Secao>

      <Secao titulo="Observações">
        <Campo span="sm:col-span-6" htmlFor="observacoes" rotulo="Observações" opcional>
          <Textarea
            id="observacoes"
            name="observacoes"
            defaultValue={valor('observacoes', fornecedor?.observacoes ?? '')}
            erro={erroDe('observacoes')}
            maxLength={500}
            placeholder="Prazo de entrega, condições de pagamento…"
          />
        </Campo>
      </Secao>

      <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
        <Button asChild variant="secundario">
          <Link href="/cadastro/fornecedores">Cancelar</Link>
        </Button>
        <BotaoSalvar novo={novo} />
      </div>
    </form>
  )
}
