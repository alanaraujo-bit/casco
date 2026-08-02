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
import type { EstadoFormularioTabela } from '@/modules/tabelas-preco/esquema'
import type { TabelaPreco } from '@/db/schema'

type Props = {
  acao: (
    anterior: EstadoFormularioTabela,
    form: FormData,
  ) => Promise<EstadoFormularioTabela>
  tabela?: TabelaPreco
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
          {novo ? 'Criar tabela' : 'Salvar alterações'}
        </>
      )}
    </Button>
  )
}

export function FormularioTabela({ acao, tabela }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioTabela, FormData>(acao, {})
  const novo = !tabela
  const erroDe = (campo: keyof NonNullable<EstadoFormularioTabela['campos']>) =>
    estado.campos?.[campo]

  const formRef = useRef<HTMLFormElement>(null)

  const valor = (campo: keyof NonNullable<EstadoFormularioTabela['valores']>, doBanco = '') =>
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

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="nome">Nome da tabela</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={valor('nome', tabela?.nome ?? '')}
              erro={erroDe('nome')}
              autoFocus={novo}
              autoComplete="off"
              maxLength={60}
              placeholder="Revenda"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="padrao">Tabela padrão?</Label>
            <Select
              id="padrao"
              name="padrao"
              defaultValue={valor('padrao', tabela?.padrao ? 'true' : 'false')}
              erro={erroDe('padrao')}
            >
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </Select>
          </div>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
        <Button asChild variant="secundario">
          <Link href="/cadastro/tabelas-preco">Cancelar</Link>
        </Button>
        <BotaoSalvar novo={novo} />
      </div>
    </form>
  )
}
