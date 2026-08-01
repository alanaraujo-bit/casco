'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CircleCheck, KeyRound, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { alternarAcesso, redefinirSenhaAcesso } from '@/modules/admin/acoes'
import { DESCRICAO_PAPEL, type EstadoAcesso, type PapelAcesso } from '@/modules/admin/esquema'
import { formatarData } from '@/lib/formatos'
import type { AcessoResumo } from '@/modules/admin/consultas'

function BotaoEnviar({
  children,
  pendente,
  variant = 'secundario',
}: {
  children: React.ReactNode
  pendente: string
  variant?: 'secundario' | 'primario' | 'perigo'
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      disabled={pending}
      aria-disabled={pending}
      className="w-full sm:w-auto"
    >
      {pending ? pendente : children}
    </Button>
  )
}

/**
 * Uma pessoa com acesso à distribuidora, e o que dá para fazer com ela.
 *
 * Redefinir senha abre um campo na própria linha em vez de navegar para outra
 * tela: é uma operação de trinta segundos, feita com a pessoa no telefone
 * esperando. Tela nova aqui seria perder o contexto de quem se está atendendo.
 */
export function LinhaAcesso({ acesso, companyId }: { acesso: AcessoResumo; companyId: string }) {
  const [estado, redefinir] = useActionState<EstadoAcesso, FormData>(redefinirSenhaAcesso, {})

  /**
   * Em que tentativa o campo foi aberto, ou `null` se está fechado.
   *
   * Guardar o número em vez de um booleano é o que deixa "fechar quando grava"
   * ser derivado, sem `useEffect`: o campo some assim que chega um sucesso
   * posterior à abertura — deixá-lo aberto com a senha ainda à vista convida a
   * redefinir duas vezes por engano. Reabrir marca a tentativa atual, então o
   * sucesso antigo não fecha a caixa recém-aberta.
   */
  const [aberturaEm, setAberturaEm] = useState<number | null>(null)
  const tentativa = estado.tentativa ?? 0
  const abrirSenha = aberturaEm !== null && !(estado.ok && tentativa > aberturaEm)

  const papel = DESCRICAO_PAPEL[acesso.papel as PapelAcesso]

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-texto">{acesso.nome}</span>
            <Badge variant={acesso.papel === 'dono' ? 'acento' : 'neutro'}>
              {papel?.rotulo ?? acesso.papel}
            </Badge>
            {!acesso.ativo && <Badge variant="perigo">Desativado</Badge>}
          </div>
          <p className="truncate text-xs text-texto-fraco">
            {acesso.email} · desde {formatarData(acesso.criadoEm)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="fantasma"
            size="sm"
            onClick={() => setAberturaEm(abrirSenha ? null : tentativa)}
            aria-expanded={abrirSenha}
            className="w-full sm:w-auto"
          >
            <KeyRound aria-hidden />
            Redefinir senha
          </Button>

          <form action={alternarAcesso}>
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="usuarioId" value={acesso.id} />
            <input type="hidden" name="ativo" value={acesso.ativo ? 'false' : 'true'} />
            <BotaoEnviar
              variant={acesso.ativo ? 'secundario' : 'primario'}
              pendente={acesso.ativo ? 'Desativando…' : 'Reativando…'}
            >
              {acesso.ativo ? 'Desativar' : 'Reativar'}
            </BotaoEnviar>
          </form>
        </div>
      </div>

      {estado.ok && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md bg-sucesso-bg px-3 py-2 text-sm text-sucesso"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.ok}</span>
        </div>
      )}

      {abrirSenha && (
        <form
          key={estado.tentativa ?? 0}
          action={redefinir}
          className="mt-3 space-y-2 border-t border-borda pt-3"
          noValidate
        >
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="usuarioId" value={acesso.id} />

          {estado.erro && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2 text-sm text-perigo"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{estado.erro}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`senha-${acesso.id}`}>Nova senha de {acesso.nome}</Label>
              <Input
                id={`senha-${acesso.id}`}
                // `novaSenha` e não `senha`: o formulário de criar acesso está
                // na mesma página, com um campo `senha` próprio. Dois campos de
                // mesmo nome em documentos diferentes seria irrelevante — no
                // mesmo documento, é ambiguidade para o preenchimento
                // automático do navegador e para qualquer script que procure
                // o campo pelo nome.
                name="novaSenha"
                type="text"
                erro={estado.campos?.senha}
                autoComplete="new-password"
                maxLength={72}
                autoFocus
                placeholder="pelo menos 8 caracteres"
              />
            </div>
            <BotaoEnviar variant="primario" pendente="Salvando…">
              Salvar senha
            </BotaoEnviar>
          </div>
        </form>
      )}
    </Card>
  )
}
