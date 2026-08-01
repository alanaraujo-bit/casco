'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { CircleCheck, TriangleAlert, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { criarAcesso } from '@/modules/admin/acoes'
import { DESCRICAO_PAPEL, PAPEIS, type EstadoAcesso } from '@/modules/admin/esquema'

function BotaoCriar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Criando…'
      ) : (
        <>
          <UserPlus aria-hidden />
          Criar acesso
        </>
      )}
    </Button>
  )
}

/**
 * O formulário de criar acesso.
 *
 * O `key={estado.tentativa}` remonta o formulário a cada envio — é o que faz o
 * `defaultValue` reler os valores devolvidos pela action. Sem ele o React 19
 * limparia os campos ao terminar, inclusive em erro, e o admin redigitaria tudo
 * por causa de um e-mail repetido. A senha é a única que não volta, de
 * propósito: ver `EstadoAcesso`.
 */
export function FormularioAcesso({ companyId }: { companyId: string }) {
  const [estado, enviar] = useActionState<EstadoAcesso, FormData>(criarAcesso, {})
  const formRef = useRef<HTMLFormElement>(null)

  const erroDe = (campo: keyof NonNullable<EstadoAcesso['campos']>) => estado.campos?.[campo]
  const valor = (campo: keyof NonNullable<EstadoAcesso['valores']>, padrao = '') =>
    estado.valores?.[campo] ?? padrao

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  return (
    <Card className="p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-texto">Criar acesso</h2>
        <p className="mt-0.5 text-xs text-texto-suave">
          A senha é definida aqui e repassada por você. Não há convite por e-mail.
        </p>
      </div>

      <form
        key={estado.tentativa ?? 0}
        ref={formRef}
        action={enviar}
        className="space-y-4"
        noValidate
      >
        <input type="hidden" name="companyId" value={companyId} />

        {estado.erro && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{estado.erro}</span>
          </div>
        )}

        {estado.ok && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md bg-sucesso-bg px-3 py-2.5 text-sm text-sucesso"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{estado.ok}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={valor('nome')}
              erro={erroDe('nome')}
              autoComplete="off"
              maxLength={120}
              placeholder="Maria da Silva"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={valor('email')}
              erro={erroDe('email')}
              autoComplete="off"
              maxLength={160}
              placeholder="maria@distribuidora.com.br"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="text"
              erro={erroDe('senha')}
              // `type="text"` e `autoComplete="new-password"`: quem digita aqui
              // não é o dono da senha, é quem vai ditá-la por telefone. Campo
              // mascarado força conferir às cegas o que será repassado em voz
              // alta, e o gerenciador do navegador não deve guardar isto.
              autoComplete="new-password"
              maxLength={72}
              placeholder="pelo menos 8 caracteres"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="papel">Nível de acesso</Label>
            <Select
              id="papel"
              name="papel"
              defaultValue={valor('papel', 'operador')}
              erro={erroDe('papel')}
            >
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {DESCRICAO_PAPEL[p].rotulo} — {DESCRICAO_PAPEL[p].resumo}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <BotaoCriar />
      </form>
    </Card>
  )
}
