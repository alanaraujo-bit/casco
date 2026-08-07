'use client'

import { useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Confirmação de exclusão que só libera o botão quando a pessoa digita o nome
 * do que vai excluir — igual ao GitHub para apagar repositório.
 *
 * Existe porque um clique duplo (o padrão do resto do sistema, ver
 * `BotaoExcluirCadastro`) é fricção suficiente para inativar um produto, mas
 * não para desligar o acesso de uma pessoa ou desativar a distribuidora
 * inteira: exige ler o nome de quem vai sofrer o efeito, não só confirmar uma
 * intenção genérica.
 */
export function DialogConfirmarExclusao({
  trigger,
  titulo,
  descricao,
  nomeConfirmacao,
  rotuloConfirmacao,
  rotuloPendente,
  action,
  camposOcultos,
}: {
  trigger: ReactNode
  titulo: string
  descricao: string
  /** O que a pessoa precisa digitar, exatamente, para habilitar o botão. */
  nomeConfirmacao: string
  rotuloConfirmacao: string
  rotuloPendente: string
  action: (form: FormData) => void | Promise<void>
  /** Campos hidden do formulário (ids etc.), como `<input type="hidden">`. */
  camposOcultos?: Record<string, string>
}) {
  const [aberto, setAberto] = useState(false)
  const [digitado, setDigitado] = useState('')
  const habilitado = digitado === nomeConfirmacao

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v)
        if (!v) setDigitado('')
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent titulo={titulo} descricao={descricao}>
        <form
          action={async (form) => {
            await action(form)
            setAberto(false)
          }}
          className="space-y-4"
        >
          {Object.entries(camposOcultos ?? {}).map(([nome, valor]) => (
            <input key={nome} type="hidden" name={nome} value={valor} />
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="confirmacao-nome">
              Digite <span className="font-semibold text-texto">{nomeConfirmacao}</span> para
              confirmar
            </Label>
            <Input
              id="confirmacao-nome"
              name="confirmacaoExclusao"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

          <BotaoConfirmar habilitado={habilitado} pendente={rotuloPendente}>
            {rotuloConfirmacao}
          </BotaoConfirmar>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BotaoConfirmar({
  habilitado,
  pendente,
  children,
}: {
  habilitado: boolean
  pendente: string
  children: ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="perigo"
      disabled={!habilitado || pending}
      aria-disabled={!habilitado || pending}
      className="w-full"
    >
      {pending ? pendente : children}
    </Button>
  )
}
