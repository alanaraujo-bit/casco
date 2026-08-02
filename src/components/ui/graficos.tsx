'use client'

import * as React from 'react'
import { cn, moeda } from '@/lib/utils'

/**
 * Gráficos em SVG puro, sem biblioteca.
 *
 * Uma biblioteca de gráficos traz toolbar de zoom, pan e exportação em cima de
 * um gráfico de seis pontos — complexidade que ninguém usa e que custa uns
 * 200 kB no celular do dono. Aqui o gráfico faz uma coisa: mostrar a forma do
 * número. Quem quer o detalhe clica na tabela embaixo.
 *
 * Todos usam `viewBox` com `preserveAspectRatio="none"` e
 * `vector-effect="non-scaling-stroke"`: o desenho estica com o container sem
 * JavaScript de medição, e a linha continua com a mesma espessura em qualquer
 * largura — que é o defeito visível de quem estica SVG sem isso.
 */

/* -------------------------------------------------------------------------- */

/**
 * Formato do número, por nome e não por função.
 *
 * Poderia ser `formatar: (n) => string`, e era o desenho natural — mas função
 * não atravessa a fronteira do servidor para o cliente, e o painel inteiro é
 * Server Component. Passar `formatar={moeda}` compila, passa no TypeScript e
 * quebra só na hora de gerar a página. Nome resolve no cliente e não tem como
 * dar errado.
 */
export type Formato = 'moeda' | 'numero' | 'inteiro'

const FORMATADORES: Record<Formato, (n: number) => string> = {
  moeda,
  numero: (n) => n.toLocaleString('pt-BR'),
  inteiro: (n) => Math.round(n).toLocaleString('pt-BR'),
}

export interface PontoSerie {
  rotulo: string
  valor: number
  /** Período ainda em curso. Marcado no eixo para não ser lido como queda. */
  parcial?: boolean
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
  titulo,
  cor = 'var(--acento)',
  altura = 160,
  formato = 'numero',
  eixo = false,
  className,
}: {
  serie: PontoSerie[]
  /** Vira a legenda da tabela acessível. Sem ele, duas séries na mesma tela
      soam idênticas para quem usa leitor de tela. */
  titulo: string
  cor?: string
  altura?: number
  formato?: Formato
  /** Mostra os rótulos do eixo X, alinhados aos pontos. */
  eixo?: boolean
  className?: string
}) {
  const formatar = FORMATADORES[formato]
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
    // `mb-5` quando há eixo: os rótulos ficam posicionados abaixo da caixa de
    // altura fixa, e sem essa margem eles cairiam por cima do que vem depois.
    <div
      className={cn('relative', eixo && 'mb-5', className)}
      style={{ height: altura }}
    >
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

      {/* Escala à direita, nas mesmas alturas das linhas de base. Dá leitura de
          grandeza sem depender de passar o mouse — que no celular não existe. */}
      {eixo &&
        [0.25, 0.5, 0.75].map((f) => (
          <span
            key={f}
            className="pointer-events-none absolute right-0 -translate-y-1/2 bg-superficie px-1 text-2xs tabular-nums text-texto-fraco dark:bg-superficie-elevada"
            style={{ top: `${f * 100}%` }}
            aria-hidden
          >
            {formatar(topo * (1 - f))}
          </span>
        ))}

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
          ponto mais próximo por coordenada de mouse erra perto das bordas.
          `onPointerEnter` e não `onMouseEnter`: no celular não existe hover, e
          o dono olha o faturamento justamente no celular. Sem isto o gráfico
          não entrega um único número no toque. */}
      <div
        className="absolute inset-0 flex"
        onPointerLeave={() => setAtivo(null)}
      >
        {serie.map((p, i) => (
          <div
            key={p.rotulo}
            className="group relative flex-1"
            onPointerEnter={() => setAtivo(i)}
            onPointerDown={() => setAtivo(i)}
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
          leitor de tela. Sem ela o gráfico simplesmente não existe.
          `sr-only` no `div` externo, não na `table`: `overflow`/`clip-path`
          na própria tabela não clipa o `<caption>` — ele vive na "table
          wrapper box", fora da caixa que recebe o corte — e o título vaza
          visível na tela. */}
      <div className="sr-only">
        <table>
          <caption>{titulo}</caption>
          <tbody>
            {serie.map((p) => (
              <tr key={p.rotulo}>
                <th scope="row">
                  {p.rotulo}
                  {p.parcial ? ' (parcial)' : ''}
                </th>
                <td>{formatar(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Eixo dentro do componente, posicionado pelo MESMO cálculo dos pontos.
          Antes cada página desenhava os rótulos com `flex-1`, cujos centros
          caem em 4,2% / 12,5% / … enquanto os pontos caem em 0% / 9,1% / … —
          o pico de julho não ficava sobre "Jul". */}
      {eixo && (
        <div className="absolute inset-x-0 top-full pt-1.5" aria-hidden>
          {serie.map((p, i) => {
            const primeiro = i === 0
            const ultimo = i === serie.length - 1
            return (
              <span
                key={p.rotulo}
                className={cn(
                  'absolute whitespace-nowrap text-2xs text-texto-fraco',
                  // As pontas ancoram na borda em vez de centralizar no ponto:
                  // centralizado, metade de "set/25" cai fora do cartão à
                  // esquerda e metade de "ago/26" fora à direita.
                  primeiro ? 'left-0' : ultimo ? 'right-0' : '-translate-x-1/2',
                  // Doze meses num celular de 390px dão 32px por rótulo, e
                  // "set/25" precisa de 30 — eles encavalam e viram uma tira
                  // ilegível. Acima de oito pontos o eixo mostra um sim, um
                  // não no estreito, e todos a partir de `sm`. Alternar é
                  // melhor que encolher a fonte: metade dos meses legíveis
                  // ainda situa a linha, doze meses ilegíveis não situam nada.
                  //
                  // A paridade é contada **do fim para o começo**, e não do
                  // começo: assim o último ponto nunca é o que some, e ele é o
                  // mês corrente — o único que o dono abriu a tela para ver.
                  serie.length > 8 &&
                    (serie.length - 1 - i) % 2 === 1 &&
                    'hidden sm:inline',
                )}
                style={primeiro || ultimo ? undefined : { left: `${pontos[i].x}%` }}
              >
                {p.rotulo}
                {p.parcial && <span className="text-acento-texto"> ·</span>}
              </span>
            )
          })}
        </div>
      )}
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
  formato = 'numero',
  className,
}: {
  fatias: FatiaRosca[]
  titulo: string
  /** Texto pequeno sob o total. Ex.: "galões". */
  totalRotulo?: string
  formato?: Formato
  className?: string
}) {
  const formatar = FORMATADORES[formato]
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
  formato = 'numero',
}: {
  rotulo: string
  valor: number
  maximo: number
  cor?: string
  formato?: Formato
}) {
  const formatar = FORMATADORES[formato]
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
  titulo,
  cor = 'var(--acento)',
  altura = 120,
  formato = 'numero',
  destacarUltima = false,
}: {
  serie: PontoSerie[]
  titulo: string
  cor?: string
  altura?: number
  formato?: Formato
  /** Pinta a última coluna com o acento cheio — normalmente "hoje". */
  destacarUltima?: boolean
}) {
  const formatar = FORMATADORES[formato]
  const max = Math.max(...serie.map((p) => p.valor), 1)

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: altura }}>
        {serie.map((p, i) => {
          const ultima = destacarUltima && i === serie.length - 1
          return (
            <div key={p.rotulo} className="flex h-full flex-1 flex-col justify-end">
              {/* Valor sempre visível, não só no hover: no toque não há hover, e
                  sem ele a coluna vira desenho sem informação nenhuma. */}
              <span
                className={cn(
                  'mb-1 text-center text-2xs tabular-nums',
                  ultima ? 'font-semibold text-texto' : 'text-texto-fraco',
                )}
              >
                {formatar(p.valor)}
              </span>
              <div
                className="w-full rounded-t-md transition-[height] duration-500"
                style={{
                  height: `${(p.valor / max) * 100}%`,
                  background: cor,
                  opacity: ultima ? 1 : 0.45,
                  minHeight: 2,
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {serie.map((p, i) => (
          <span
            key={p.rotulo}
            className={cn(
              'flex-1 truncate text-center text-2xs',
              destacarUltima && i === serie.length - 1
                ? 'font-medium text-texto-suave'
                : 'text-texto-fraco',
            )}
          >
            {p.rotulo}
          </span>
        ))}
      </div>

      {/* `sr-only` no `div` externo, não na `table` — ver nota em
          `GraficoArea` sobre o `<caption>` escapando do `overflow`. */}
      <div className="sr-only">
        <table>
          <caption>{titulo}</caption>
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
    </div>
  )
}
