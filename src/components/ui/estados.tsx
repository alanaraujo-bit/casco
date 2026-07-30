import * as React from 'react'
import { Ban, Inbox, RotateCw, TriangleAlert, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Base dos estados de tela cheia (vazio, erro, sem permissão, offline).
 *
 * Todos nascem do mesmo componente de propósito: o diagnóstico que fizemos do
 * sistema antigo foi "cada tela foi decidida isoladamente". Estado improvisado
 * tela a tela é justamente como se chega lá.
 */
function Estado({
  Icone,
  tom = 'neutro',
  titulo,
  descricao,
  acao,
  className,
}: {
  Icone: typeof Inbox
  tom?: 'neutro' | 'perigo' | 'alerta'
  titulo: string
  descricao: string
  acao?: React.ReactNode
  className?: string
}) {
  const tons = {
    neutro: 'bg-superficie-afundada text-texto-suave',
    perigo: 'bg-perigo-bg text-perigo',
    alerta: 'bg-alerta-bg text-alerta',
  } as const

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className={cn('grid size-11 place-items-center rounded-full', tons[tom])}>
        <Icone className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-texto">{titulo}</p>
        {/* max-w em ch: linha de texto longa demais é difícil de reler, e
            estado vazio é exatamente onde o usuário está perdido. */}
        <p className="mx-auto max-w-[46ch] text-sm text-texto-suave">{descricao}</p>
      </div>
      {acao}
    </div>
  )
}

/**
 * Nada cadastrado ainda. Sempre com a ação primária junto: estado vazio sem
 * saída deixa o usuário parado olhando uma tela morta.
 */
export function EstadoVazio({
  titulo = 'Nenhum registro encontrado',
  descricao,
  acao,
}: {
  titulo?: string
  descricao: string
  acao?: React.ReactNode
}) {
  return <Estado Icone={Inbox} titulo={titulo} descricao={descricao} acao={acao} />
}

export function EstadoErro({
  descricao = 'Não conseguimos carregar estas informações. Isso costuma ser temporário.',
  aoTentarNovamente,
}: {
  descricao?: string
  aoTentarNovamente?: () => void
}) {
  return (
    <Estado
      Icone={TriangleAlert}
      tom="perigo"
      titulo="Algo deu errado"
      descricao={descricao}
      acao={
        aoTentarNovamente && (
          <Button variant="secundario" onClick={aoTentarNovamente}>
            <RotateCw aria-hidden />
            Tentar de novo
          </Button>
        )
      }
    />
  )
}

/**
 * O sistema antigo devolve "Acesso negado. Procure o administrador da conta"
 * e para por aí — foi o que barrou nossa auditoria no PDV. Aqui a tela diz
 * o que fazer e oferece saída, em vez de deixar o usuário num beco.
 */
export function SemPermissao({
  recurso,
  acao,
}: {
  recurso: string
  acao?: React.ReactNode
}) {
  return (
    <Estado
      Icone={Ban}
      tom="alerta"
      titulo="Você não tem acesso a esta tela"
      descricao={`Seu usuário não tem permissão para ${recurso}. Peça ao responsável pela conta para liberar.`}
      acao={acao}
    />
  )
}

/**
 * Sem conexão. Fala em nome do entregador: entre Tucumã e Ourilândia o sinal
 * cai, e a mensagem precisa dizer que o trabalho dele não se perdeu.
 */
export function EstadoOffline({
  pendentes = 0,
}: {
  /** Quantas operações estão na fila esperando sinal. */
  pendentes?: number
}) {
  return (
    <Estado
      Icone={WifiOff}
      tom="alerta"
      titulo="Sem conexão"
      descricao={
        pendentes > 0
          ? `Você pode continuar trabalhando normalmente. ${pendentes} ${
              pendentes === 1 ? 'lançamento será enviado' : 'lançamentos serão enviados'
            } assim que o sinal voltar.`
          : 'Você pode continuar trabalhando normalmente. Tudo que registrar agora será enviado assim que o sinal voltar.'
      }
    />
  )
}

/** Faixa fina de offline, para usar no topo do app sem interromper a tarefa. */
export function FaixaOffline({ pendentes = 0 }: { pendentes?: number }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-alerta-bg px-4 py-1.5 text-xs font-medium text-alerta"
    >
      <WifiOff className="size-3.5" aria-hidden />
      <span>
        Sem conexão — trabalhando offline
        {pendentes > 0 && ` · ${pendentes} na fila`}
      </span>
    </div>
  )
}
