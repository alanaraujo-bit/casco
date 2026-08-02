import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Peças do painel.
 *
 * Uma parede de números do mesmo tamanho e da mesma cor faz o dono ler tudo e
 * enxergar nada. Aqui existe hierarquia declarada: cor identifica o assunto,
 * tamanho identifica a importância, e variação identifica se é notícia boa.
 */

/**
 * Dois grupos, e a diferença importa.
 *
 * Semânticos (`sucesso`, `alerta`, `perigo`, `info`) significam ESTADO. Usá-los
 * para decorar é o erro que faz uma tela parecer montada por sorteio: verde num
 * atalho de "Receber título" sugere que algo já foi recebido, âmbar em "Baixa
 * de vasilhame" sugere pendência. Para diferenciar sem afirmar nada, usa-se a
 * família categórica `cat-1..6`.
 */
export type TomSemantico = 'acento' | 'sucesso' | 'alerta' | 'perigo' | 'info' | 'roxo'
export type TomCategoria = 'cat-1' | 'cat-2' | 'cat-3' | 'cat-4' | 'cat-5' | 'cat-6'
export type Tom = TomSemantico | TomCategoria

const TONS: Record<TomSemantico, { chip: string; texto: string; cor: string }> = {
  acento: { chip: 'bg-acento-suave', texto: 'text-acento-texto', cor: 'var(--acento)' },
  sucesso: { chip: 'bg-sucesso-bg', texto: 'text-sucesso', cor: 'var(--sucesso)' },
  alerta: { chip: 'bg-alerta-bg', texto: 'text-alerta', cor: 'var(--alerta)' },
  perigo: { chip: 'bg-perigo-bg', texto: 'text-perigo', cor: 'var(--perigo)' },
  info: { chip: 'bg-info-bg', texto: 'text-info', cor: 'var(--info)' },
  roxo: { chip: 'bg-roxo-bg', texto: 'text-roxo', cor: 'var(--roxo)' },
}

const ehCategoria = (tom: Tom): tom is TomCategoria => tom.startsWith('cat-')

export function corDoTom(tom: Tom) {
  return ehCategoria(tom) ? `var(--${tom})` : TONS[tom].cor
}

/**
 * Quadradinho de ícone colorido. Reusado no KPI, na atividade e nas ações.
 *
 * Para as categóricas o fundo sai de `color-mix` (a mesma cor a 14%) e a tinta
 * do ícone é a variante `-forte`. A cor de gráfico tem luminosidade pensada
 * para preencher área, não para desenhar traço de 2px: usada como tinta ela
 * reprova no contraste de texto.
 */
export function Chip({
  Icone,
  tom = 'acento',
  tamanho = 'md',
}: {
  Icone: LucideIcon
  tom?: Tom
  tamanho?: 'sm' | 'md'
}) {
  const categoria = ehCategoria(tom)
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        !categoria && TONS[tom as TomSemantico].chip,
        !categoria && TONS[tom as TomSemantico].texto,
        tamanho === 'sm' ? 'size-8' : 'size-10',
      )}
      style={
        categoria
          ? {
              background: `color-mix(in oklch, var(--${tom}) 14%, transparent)`,
              color: `var(--${tom}-forte)`,
            }
          : undefined
      }
      aria-hidden
    >
      <Icone className={tamanho === 'sm' ? 'size-4' : 'size-5'} />
    </span>
  )
}

/**
 * Variação contra o período anterior.
 *
 * `bom` existe porque nem toda subida é boa: faturamento subindo é verde,
 * vasilhame quebrado subindo é vermelho. Amarrar a cor ao sinal da conta seria
 * o tipo de detalhe que passa despercebido e ensina o número errado.
 */
export function Variacao({
  atual,
  anterior,
  bom = 'subir',
}: {
  atual: number
  anterior: number
  bom?: 'subir' | 'descer'
}) {
  if (!anterior) return null
  const delta = ((atual - anterior) / anterior) * 100
  const subiu = delta >= 0
  const positivo = bom === 'subir' ? subiu : !subiu
  const Icone = subiu ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-medium tabular-nums',
        positivo ? 'bg-sucesso-bg text-sucesso' : 'bg-perigo-bg text-perigo',
      )}
    >
      <Icone className="size-3" aria-hidden />
      {subiu ? '+' : ''}
      {delta.toFixed(1).replace('.', ',')}%
      <span className="sr-only">
        {' '}
        em relação ao período anterior — {positivo ? 'evolução positiva' : 'atenção'}
      </span>
    </span>
  )
}

/** Cartão de indicador: assunto, número grande, variação e um gráfico opcional. */
export function CartaoKpi({
  rotulo,
  valor,
  detalhe,
  Icone,
  tom = 'acento',
  variacao,
  href,
  grafico,
}: {
  rotulo: string
  valor: string
  detalhe?: React.ReactNode
  Icone: LucideIcon
  tom?: Tom
  variacao?: React.ReactNode
  href?: string
  grafico?: React.ReactNode
}) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-texto-suave">{rotulo}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-texto">
            {valor}
          </p>
        </div>
        <Chip Icone={Icone} tom={tom} />
      </div>

      {(variacao || detalhe) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          {variacao}
          {detalhe && <span className="min-w-0 truncate">{detalhe}</span>}
        </div>
      )}

      {grafico && <div className="-mx-1 mt-3">{grafico}</div>}
    </>
  )

  const classe = cn(
    'relative p-4',
    href &&
      'transition-colors hover:border-borda-forte focus-within:border-borda-forte',
  )

  if (!href) return <Card className={classe}>{conteudo}</Card>

  return (
    <Card className={classe}>
      {/* Link cobrindo o cartão, mas ancorado no rótulo: continua sendo um
          link de verdade para o teclado e para o leitor de tela. */}
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
      >
        <span className="sr-only">{rotulo} — abrir detalhe</span>
      </Link>
      {conteudo}
    </Card>
  )
}

/** Cartão de seção, com título e link opcional para a tela completa. */
export function Bloco({
  titulo,
  descricao,
  href,
  hrefRotulo = 'Ver tudo',
  acao,
  children,
  className,
}: {
  titulo: string
  descricao?: string
  href?: string
  hrefRotulo?: string
  acao?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-texto">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-xs text-texto-suave">{descricao}</p>}
        </div>
        {acao ??
          (href && (
            <Link
              href={href}
              // -my-2/-mr-2 + padding: 44px de alvo no toque sem empurrar o
              // layout. Era um link de 18px de altura, e é a única entrada
              // para o bloco pelo celular.
              className="-my-2 -mr-2 shrink-0 rounded px-2 py-2 text-xs font-medium text-acento-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:-my-1 md:py-1"
            >
              {hrefRotulo}
            </Link>
          ))}
      </div>
      <div className="flex-1 px-4 pb-4">{children}</div>
    </Card>
  )
}

/**
 * Atalho grande e colorido.
 *
 * Os atalhos cobrem o que a operadora faz o dia inteiro, para que ela não
 * precise passar pelo menu a cada lançamento; o resto continua no menu.
 *
 * Só entram aqui telas que existem. Atalho com selo "em breve" foi removido:
 * ele ocupa o lugar mais nobre da tela para prometer, e quem trabalha no balcão
 * aprende em dois dias a não olhar para aquele canto.
 */
export function AcaoRapida({
  titulo,
  descricao,
  Icone,
  tom,
  href,
}: {
  titulo: string
  descricao: string
  Icone: LucideIcon
  tom: Tom
  href: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-borda bg-superficie p-3 shadow-sm',
        'transition-[border-color,transform] hover:-translate-y-px hover:border-borda-forte',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
        'dark:bg-superficie-elevada dark:shadow-none',
      )}
    >
      <Chip Icone={Icone} tom={tom} />
      <span className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-texto">{titulo}</span>
        <span className="block truncate text-xs text-texto-suave">{descricao}</span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-texto-fraco transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  )
}
