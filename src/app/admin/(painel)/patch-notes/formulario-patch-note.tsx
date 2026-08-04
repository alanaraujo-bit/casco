'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Save } from 'lucide-react'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  CATEGORIAS_PATCH_NOTE,
  ROTULO_CATEGORIA_PATCH_NOTE,
  type EstadoFormularioPatchNoteAdmin,
} from '@/modules/patch-notes/esquema'

function BotaoSalvar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          {rotulo}
        </>
      )}
    </Button>
  )
}

type Acao = (
  estado: EstadoFormularioPatchNoteAdmin,
  form: FormData,
) => Promise<EstadoFormularioPatchNoteAdmin>

/**
 * Formulário de criar/editar, reusado nas duas telas — só o `acao` e o
 * rótulo do botão mudam. Devolve o que foi digitado em erro (o React 19 limpa
 * o formulário quando a action termina, `AGENTS.md`), via `estado.valores`.
 */
export function FormularioPatchNote({
  acao,
  inicial,
  rotuloBotao,
}: {
  acao: Acao
  inicial?: {
    titulo: string
    resumo: string
    corpo: string
    categoria: string
    commitsOrigem: string[]
  }
  rotuloBotao: string
}) {
  const [estado, executar] = useActionState<EstadoFormularioPatchNoteAdmin, FormData>(acao, {})
  const v = estado.valores

  return (
    <form action={executar} className="space-y-4" noValidate>
      <AvisoErro erro={estado.erro} />

      {estado.sucesso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md bg-sucesso-bg px-3 py-2.5 text-sm text-sucesso"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Salvo.</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="titulo"
          defaultValue={v?.titulo ?? inicial?.titulo ?? ''}
          erro={estado.campos?.titulo}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resumo">Resumo</Label>
        <Input
          id="resumo"
          name="resumo"
          defaultValue={v?.resumo ?? inicial?.resumo ?? ''}
          erro={estado.campos?.resumo}
          maxLength={200}
          placeholder="Uma frase, para o card fechado"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria">Categoria</Label>
        <Select
          id="categoria"
          name="categoria"
          defaultValue={v?.categoria ?? inicial?.categoria ?? ''}
          erro={estado.campos?.categoria}
          required
        >
          <option value="" disabled>
            Escolha…
          </option>
          {CATEGORIAS_PATCH_NOTE.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA_PATCH_NOTE[c]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="corpo">Corpo</Label>
        <Textarea
          id="corpo"
          name="corpo"
          defaultValue={v?.corpo ?? inicial?.corpo ?? ''}
          erro={estado.campos?.corpo}
          placeholder={'Markdown simples: parágrafos, linhas com "- " viram lista, **negrito**'}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="commitsOrigem">Commits de origem (opcional)</Label>
        <Input
          id="commitsOrigem"
          name="commitsOrigem"
          defaultValue={v?.commitsOrigem ?? inicial?.commitsOrigem?.join(' ') ?? ''}
          placeholder="hashes curtos separados por espaço, só rastro de auditoria"
        />
      </div>

      <BotaoSalvar rotulo={rotuloBotao} />
    </form>
  )
}
