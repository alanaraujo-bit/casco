'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Gráficos em SVG puro, sem biblioteca.
 *
 * O sistema antigo usa uma biblioteca com toolbar de zoom, pan e exportação em
 * cima de um gráfico de seis pontos — complexidade que ninguém usa e que custa
 * uns 200 kB no celular do dono. Aqui o gráfico faz uma coisa: mostrar a forma
 * do número. Quem quer o detalhe clica na tabela embaixo.
 *
 * Todos usam `viewBox` com `preserveAspectRatio="none"` e
 * `vector-effect="non-scaling-stroke"`: o desenho estica com o container sem
 * JavaScript de medição, e a linha continua com a mesma espessura em qualquer
 * largura — que é o defeito visível de quem estica SVG sem isso.
 */

/* -------------------------------------------------------------------------- */

export interface PontoSerie {
  rotulo: string
  valor: number
}

/** Caminho suave por Catmull-Rom convertido em Bézier cúbica. */
function caminhoSuave(pontos: { x: number; y: number }[], tensao = 0.5) {
  if (pontos.length < 2) return ''
  let d = `M ${pontos[0].x} ${pontos[0].y}`
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tensao * 2
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tensao * 2
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tensao * 2
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tensao * 2
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/**
 * Área com gradiente. Usado no faturamento do mês a mês.
 *
 * A escala começa no zero de propósito. Cortar a base é o jeito mais fácil de
 * transformar uma variação de 3% num pico dramático — e o dono toma decisão
 * olhando este desenho.
 */
export function GraficoArea({
  serie,
  cor = 'var(--acento)',
  altura = 160,
  formatar = (n) => String(n),
  className,
}: {
  serie: PontoSerie[]
  cor?: string
  altura?: number
  formatar?: (n: number) => string
  className?: string
}) {
  const id = React.useId()
  const [ativo, setAtivo] = React.useState<number | null>(null)

  const L = 100
  const A = 40
  const max = Math.max(...serie.map((p) => p.valor), 1)
  const topo = max * 1.15 // respiro para o ponto mais alto não encostar na borda

  const pontos = serie.map((p, i) => ({
    x: serie.length === 1 ? L / 2 : (i / (serie.length - 1)) * L,
    y: A - (p.valor / topo) * A,
  }))

  const linha = caminhoSuave(pontos)
  const area = `${linha} L ${pontos[pontos.length - 1].x} ${A} L ${pontos[0].x} ${A} Z`

  return (
    <div className={cn('relative', className)} style={{ height: altura }}>
      <svg
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="size-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Linhas de base: dão leitura de altura sem virar grade de planilha. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={L}
            y1={A * f}
            y2={A * f}
            stroke="var(--borda)"
            strokeWidth="1"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} fill={`url(#g-${id})`} />
        <path
          d={linha}
          fill="none"
          stroke={cor}
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {ativo !== null && (
          <line
            x1={pontos[ativo].x}
            x2={pontos[ativo].x}
            y1="0"
            y2={A}
            stroke={cor}
            strokeWidth="1"
            strokeOpacity="0.4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Marcadores fora do SVG: dentro deles o `preserveAspectRatio="none"`
          esticaria o círculo em elipse. Posicionados em % sobre o mesmo eixo. */}
      {serie.map((p, i) => (
        <span
          key={p.rotulo}
          className={cn(
            'pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-superficie transition-opacity',
            ativo === i ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            left: `${pontos[i].x}%`,
            top: `${(pontos[i].y / A) * 100}%`,
            borderColor: cor,
          }}
        />
      ))}

      {/* Faixas de captura: uma por ponto, cobrindo a altura toda. Buscar o
          ponto mais próximo por coordenada de mouse erra perto das bordas. */}
      <div className="absolute inset-0 flex" onMouseLeave={() => setAtivo(null)}>
        {serie.map((p, i) => (
          <div
            key={p.rotulo}
            className="group relative flex-1"
            onMouseEnter={() => setAtivo(i)}
          >
            {ativo === i && (
              <div
                className={cn(
                  'pointer-events-none absolute -top-1 z-10 whitespace-nowrap rounded-md border border-borda bg-superficie-elevada px-2 py-1 shadow-md',
                  i > serie.length / 2 ? 'right-1/2 mr-1' : 'left-1/2 ml-1',
                )}
              >
                <p className="text-2xs text-texto-fraco">{p.rotulo}</p>
                <p className="text-xs font-medium tabular-nums text-texto">
                  {formatar(p.valor)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* O SVG é decorativo; a tabela abaixo é o conteúdo real para quem usa
          leitor de tela. Sem ela o gráfico simplesmente não existe. */}
      <table className="sr-only">
        <caption>Série por período</caption>
        <tbody>
          {serie.map((p) => (
            <tr key={p.rotulo}>
              <th scope="row">{p.rotulo}</th>
              <td>{formatar(p.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface FatiaRosca {
  rotulo: string
  valor: number
  cor: string
}

/**
 * Rosca com o total no centro.
 *
 * Rosca e não pizza: o buraco no meio é onde mora o número que importa, e
 * comparar ângulo é notoriamente pior que ler o valor. A legenda traz valor e
 * porcentagem, justamente porque a fatia sozinha não se lê com precisão.
 */
export function GraficoRosca({
  fatias,
  titulo,
  totalRotulo,
  formatar = (n) => String(n),
  className,
}: {
  fatias: FatiaRosca[]
  titulo: string
  /** Texto pequeno sob o total. Ex.: "galões". */
  totalRotulo?: string
  formatar?: (n: number) => string
  className?: string
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  const raio = 42
  const circunferencia = 2 * Math.PI * raio
  let acumulado = 0

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row', className)}>
      <div className="relative shrink-0">
        <svg viewBox="0 0 100 100" className="size-36 -rotate-90" role="img" aria-label={titulo}>
          <circle
            cx="50"
            cy="50"
            r={raio}
            fill="none"
            stroke="var(--superficie-afundada)"
            strokeWidth="14"
          />
          {fatias.map((f) => {
            const fracao = total > 0 ? f.valor / total : 0
            const dash = fracao * circunferencia
            const offset = -acumulado * circunferencia
            acumulado += fracao
            return (
              <circle
                key={f.rotulo}
                cx="50"
                cy="50"
                r={raio}
                fill="none"
                stroke={f.cor}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circunferencia - dash}`}
                strokeDashoffset={offset}
                // Sem isto, fatias vizinhas encostam e viram um anel só.
                strokeLinecap="butt"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-semibold tabular-nums text-texto">
              {formatar(total)}
            </p>
            {totalRotulo && <p className="text-2xs text-texto-fraco">{totalRotulo}</p>}
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: f.cor }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-texto-suave">{f.rotulo}</span>
            <span className="shrink-0 font-medium tabular-nums text-texto">
              {formatar(f.valor)}
            </span>
            <span className="w-11 shrink-0 text-right text-2xs tabular-nums text-texto-fraco">
              {total > 0 ? Math.round((f.valor / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** Barra horizontal com rótulo e valor. Ranking de produto, meta, ocupação. */
export function BarraProgresso({
  rotulo,
  valor,
  maximo,
  cor = 'var(--acento)',
  formatar = (n) => String(n),
}: {
  rotulo: string
  valor: number
  maximo: number
  cor?: string
  formatar?: (n: number) => string
}) {
  const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-texto">{rotulo}</span>
        <span className="shrink-0 font-medium tabular-nums text-texto-suave">
          {formatar(valor)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-superficie-afundada"
        role="progressbar"
        aria-label={rotulo}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: cor }}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Colunas comparativas. Para "entradas x saídas" no mês, onde a leitura é
 * comparar duas alturas lado a lado e não seguir uma tendência.
 */
export function GraficoColunas({
  serie,
  cor = 'var(--acento)',
  altura = 120,
  formatar = (n) => String(n),
}: {
  serie: PontoSerie[]
  cor?: string
  altura?: number
  formatar?: (n: number) => string
}) {
  const max = Math.max(...serie.map((p) => p.valor), 1)
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: altura }}>
        {serie.map((p) => (
          <div key={p.rotulo} className="group flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-2xs tabular-nums text-texto-fraco opacity-0 transition-opacity group-hover:opacity-100">
              {formatar(p.valor)}
            </span>
            <div
              className="w-full rounded-t-md transition-[height,opacity] duration-500 group-hover:opacity-80"
              style={{ height: `${(p.valor / max) * 100}%`, background: cor, minHeight: 2 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {serie.map((p) => (
          <span
            key={p.rotulo}
            className="flex-1 truncate text-center text-2xs text-texto-fraco"
          >
            {p.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}
