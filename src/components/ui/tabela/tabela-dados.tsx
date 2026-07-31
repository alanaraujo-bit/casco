'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Rows3,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EstadoErro, EstadoVazio } from '@/components/ui/estados'
import {
  Menu,
  MenuConteudo,
  MenuGatilho,
  MenuGrupoRadio,
  MenuItemCheck,
  MenuItemRadio,
  MenuRotulo,
  MenuSeparador,
} from '@/components/ui/menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { exportarCsv } from './exportar'
import type { Coluna, Densidade, Ordenacao } from './tipos'

/* -------------------------------------------------------------------------- */
/* utilidades                                                                  */
/* -------------------------------------------------------------------------- */

/** Compara respeitando acento e número dentro de texto ("Rota 2" < "Rota 10"). */
const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

/** "João" e "joao" precisam se encontrar: ninguém digita acento na busca. */
function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

const TAMANHOS_PAGINA = [25, 50, 100] as const

interface Preferencias {
  ocultas: string[]
  densidade: Densidade
  tamanhoPagina: number
}

/* -------------------------------------------------------------------------- */
/* componente                                                                  */
/* -------------------------------------------------------------------------- */

export interface TabelaDadosProps<T> {
  /**
   * Identificador estável da tela (`'contas-receber'`). É a chave sob a qual
   * as preferências de coluna, densidade e paginação são lembradas. Trocar
   * este valor faz o usuário perder o que configurou.
   */
  id: string

  colunas: Coluna<T>[]
  linhas: T[]
  chaveLinha: (linha: T) => string

  /** Descrição da tabela para leitor de tela. Vira `<caption>` invisível. */
  legenda: string

  carregando?: boolean
  erro?: boolean
  aoTentarNovamente?: () => void

  /** Texto do estado vazio. Sem ele, a tabela usa uma frase genérica. */
  vazio?: { titulo?: string; descricao: string; acao?: React.ReactNode }

  /** `false` esconde a busca. Padrão: ligada. */
  busca?: boolean
  buscaPlaceholder?: string

  /** Presente = mostra "Exportar Excel". É o prefixo do nome do arquivo. */
  nomeExportacao?: string

  /** Torna a linha inteira clicável, com âncora de verdade na coluna título. */
  linkDaLinha?: (linha: T) => string

  /** Ações à direita do cabeçalho ("Novo cliente"). */
  acoesTopo?: React.ReactNode

  tamanhoPaginaPadrao?: number
  densidadePadrao?: Densidade
}

export function TabelaDados<T>({
  id,
  colunas,
  linhas,
  chaveLinha,
  legenda,
  carregando = false,
  erro = false,
  aoTentarNovamente,
  vazio,
  busca = true,
  buscaPlaceholder = 'Buscar…',
  nomeExportacao,
  linkDaLinha,
  acoesTopo,
  tamanhoPaginaPadrao = 25,
  densidadePadrao = 'confortavel',
}: TabelaDadosProps<T>) {
  const idBusca = React.useId()

  const [termo, setTermo] = React.useState('')
  const [ordenacao, setOrdenacao] = React.useState<Ordenacao | null>(null)
  const [pagina, setPagina] = React.useState(1)

  const [prefs, setPrefs] = React.useState<Preferencias>(() => ({
    ocultas: colunas.filter((c) => c.ocultaPorPadrao && !c.fixa).map((c) => c.chave),
    densidade: densidadePadrao,
    tamanhoPagina: tamanhoPaginaPadrao,
  }))

  /* --- preferências ------------------------------------------------------ */
  // Lidas depois da montagem, de propósito: ler localStorage durante a
  // renderização faria o HTML do servidor divergir do primeiro render do
  // cliente, e o React descartaria a árvore inteira com erro de hidratação.
  const chaveArmazenamento = `casco.tabela.${id}`
  const montado = React.useRef(false)

  React.useEffect(() => {
    try {
      const bruto = localStorage.getItem(chaveArmazenamento)
      if (bruto) {
        const salvo = JSON.parse(bruto) as Partial<Preferencias>
        setPrefs((atual) => ({
          ocultas: Array.isArray(salvo.ocultas) ? salvo.ocultas : atual.ocultas,
          densidade: salvo.densidade === 'compacta' ? 'compacta' : atual.densidade,
          tamanhoPagina:
            typeof salvo.tamanhoPagina === 'number' && salvo.tamanhoPagina > 0
              ? salvo.tamanhoPagina
              : atual.tamanhoPagina,
        }))
      }
    } catch {
      // Modo privado, cota estourada, JSON corrompido por versão antiga:
      // preferência de exibição não é motivo para a tela não abrir.
    }
    montado.current = true
  }, [chaveArmazenamento])

  React.useEffect(() => {
    if (!montado.current) return
    try {
      localStorage.setItem(chaveArmazenamento, JSON.stringify(prefs))
    } catch {
      /* idem */
    }
  }, [chaveArmazenamento, prefs])

  /* --- colunas ----------------------------------------------------------- */
  const visiveis = React.useMemo(
    () => colunas.filter((c) => c.fixa || !prefs.ocultas.includes(c.chave)),
    [colunas, prefs.ocultas],
  )

  /**
   * Onde mora o link da linha: a coluna marcada como título.
   *
   * Cai para a primeira quando nenhuma se declara — e aí o comportamento é o
   * antigo. Calculado sobre as colunas VISÍVEIS porque o usuário pode esconder
   * colunas, e o link precisa acompanhar o que sobrou na tela.
   */
  const indiceTitulo = React.useMemo(() => {
    const i = visiveis.findIndex((c) => c.papelMobile === 'titulo')
    return i >= 0 ? i : 0
  }, [visiveis])

  const alternarColuna = (chave: string, mostrar: boolean) =>
    setPrefs((p) => ({
      ...p,
      ocultas: mostrar ? p.ocultas.filter((k) => k !== chave) : [...p.ocultas, chave],
    }))

  /* --- filtro ------------------------------------------------------------ */
  const termoDiferido = React.useDeferredValue(termo)

  const filtradas = React.useMemo(() => {
    const termos = normalizar(termoDiferido).split(/\s+/).filter(Boolean)
    if (termos.length === 0) return linhas
    return linhas.filter((linha) => {
      // Busca só no que está na tela: procurar em coluna escondida devolve
      // linha que o usuário não consegue ver casando com o que digitou.
      const alvo = normalizar(visiveis.map((c) => c.texto(linha)).join(' '))
      return termos.every((t) => alvo.includes(t))
    })
  }, [linhas, visiveis, termoDiferido])

  /* --- ordenação --------------------------------------------------------- */
  const ordenadas = React.useMemo(() => {
    if (!ordenacao) return filtradas
    const col = colunas.find((c) => c.chave === ordenacao.chave)
    if (!col) return filtradas

    const extrair = col.valor ?? ((l: T) => col.texto(l))
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1

    // Vazio sempre no fim, nas duas direções. Inverter também os vazios faria
    // a operadora ordenar por "Data Pagamento" e receber uma tela cheia de
    // linhas em branco — o oposto do que ela quis ver.
    const comValor: T[] = []
    const semValor: T[] = []
    for (const linha of filtradas) {
      const v = extrair(linha)
      if (v === null || v === undefined || v === '') semValor.push(linha)
      else comValor.push(linha)
    }

    comValor.sort((a, b) => {
      const va = extrair(a)!
      const vb = extrair(b)!
      if (va instanceof Date || vb instanceof Date) {
        return sinal * (new Date(va as Date).getTime() - new Date(vb as Date).getTime())
      }
      if (typeof va === 'number' && typeof vb === 'number') return sinal * (va - vb)
      return sinal * colador.compare(String(va), String(vb))
    })

    return [...comValor, ...semValor]
  }, [filtradas, colunas, ordenacao])

  /* --- paginação --------------------------------------------------------- */
  const total = ordenadas.length
  const totalPaginas = Math.max(1, Math.ceil(total / prefs.tamanhoPagina))
  // Clampa em vez de guardar no estado: filtrar de 111 para 3 registros
  // enquanto se está na página 4 mostraria uma tela vazia com dados existindo.
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * prefs.tamanhoPagina
  const daPagina = React.useMemo(
    () => ordenadas.slice(inicio, inicio + prefs.tamanhoPagina),
    [ordenadas, inicio, prefs.tamanhoPagina],
  )

  React.useEffect(() => setPagina(1), [termoDiferido, ordenacao])

  /* --- anúncio ----------------------------------------------------------- */
  // A região vive no container, que sobrevive à troca entre esqueleto e dados.
  // Colocá-la dentro do esqueleto — que é desmontado — faz o leitor anunciar
  // "Carregando" e nunca anunciar que terminou.
  const anuncio = carregando
    ? 'Carregando registros…'
    : erro
      ? 'Não foi possível carregar os registros.'
      : total === 0
        ? termo
          ? `Nenhum registro encontrado para "${termo}".`
          : 'Nenhum registro.'
        : `${total} ${total === 1 ? 'registro' : 'registros'}` +
          (totalPaginas > 1 ? `, página ${paginaAtual} de ${totalPaginas}.` : '.')

  /* --- classes de célula -------------------------------------------------- */
  const compacta = prefs.densidade === 'compacta'
  // px-3 na densidade compacta veio da revisão da 0.4: px-2 encosta o número
  // na borda da coluna vizinha e a conferência de valores fica pior, que é
  // exatamente o trabalho para o qual a densidade compacta existe.
  const padCelula = compacta ? 'px-3 py-1.5' : 'px-4 py-2.5'

  const alinhar = (c: Coluna<T>) =>
    c.alinhamento === 'direita' || (c.numerica && !c.alinhamento)
      ? 'text-right'
      : c.alinhamento === 'centro'
        ? 'text-center'
        : 'text-left'

  const ordenaveis = colunas.filter((c) => c.ordenavel !== false)

  const alternarOrdem = (chave: string) =>
    setOrdenacao((atual) =>
      atual?.chave !== chave
        ? { chave, direcao: 'asc' }
        : atual.direcao === 'asc'
          ? { chave, direcao: 'desc' }
          : null,
    )

  /* --- render ------------------------------------------------------------ */
  const mostrandoDados = !carregando && !erro && total > 0

  return (
    <div className="flex flex-col gap-3">
      {/* -------------------------------------------------- barra de controle */}
      <div className="flex flex-wrap items-center gap-2">
        {busca && (
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco"
              aria-hidden
            />
            <label htmlFor={idBusca} className="sr-only">
              Buscar em {legenda}
            </label>
            <input
              id={idBusca}
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder={buscaPlaceholder}
              // text-base no toque: abaixo de 16px o iOS dá zoom no campo ao
              // focar e não desfaz, e a tela fica torta pelo resto da sessão.
              className={cn(
                'h-11 w-full rounded-md border border-borda-controle bg-superficie',
                'pl-9 pr-9 text-base text-texto placeholder:text-texto-fraco',
                'md:h-8 md:text-sm',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                '[&::-webkit-search-cancel-button]:appearance-none',
              )}
            />
            {termo && (
              <button
                type="button"
                onClick={() => setTermo('')}
                className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded text-texto-fraco hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco md:size-6"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Limpar busca</span>
              </button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Ordenar: só no celular, onde não há cabeçalho para clicar. */}
          {ordenaveis.length > 0 && (
            <Menu>
              <MenuGatilho asChild>
                <Button variant="secundario" size="sm" className="md:hidden">
                  <ArrowDownUp aria-hidden />
                  Ordenar
                </Button>
              </MenuGatilho>
              <MenuConteudo>
                <MenuRotulo>Ordenar por</MenuRotulo>
                <MenuGrupoRadio
                  value={ordenacao ? `${ordenacao.chave}:${ordenacao.direcao}` : ''}
                  onValueChange={(v) => {
                    const [chave, direcao] = v.split(':')
                    setOrdenacao({ chave, direcao: direcao as 'asc' | 'desc' })
                  }}
                >
                  {ordenaveis.map((c) => (
                    <React.Fragment key={c.chave}>
                      <MenuItemRadio value={`${c.chave}:asc`}>
                        {c.cabecalho} ↑
                      </MenuItemRadio>
                      <MenuItemRadio value={`${c.chave}:desc`}>
                        {c.cabecalho} ↓
                      </MenuItemRadio>
                    </React.Fragment>
                  ))}
                </MenuGrupoRadio>
              </MenuConteudo>
            </Menu>
          )}

          {/* Colunas e densidade: só no ponteiro, onde a tabela existe. */}
          <Menu>
            <MenuGatilho asChild>
              <Button variant="secundario" size="sm" className="hidden md:inline-flex">
                <Columns3 aria-hidden />
                Colunas
              </Button>
            </MenuGatilho>
            <MenuConteudo>
              <MenuRotulo>Colunas visíveis</MenuRotulo>
              {colunas.map((c) => (
                <MenuItemCheck
                  key={c.chave}
                  checked={c.fixa || !prefs.ocultas.includes(c.chave)}
                  disabled={c.fixa}
                  // Sem isto o menu fecha a cada clique e esconder cinco
                  // colunas vira cinco idas ao botão.
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) => alternarColuna(c.chave, Boolean(v))}
                >
                  {c.cabecalho}
                </MenuItemCheck>
              ))}
              <MenuSeparador />
              <MenuRotulo>Densidade</MenuRotulo>
              <MenuGrupoRadio
                value={prefs.densidade}
                onValueChange={(v) =>
                  setPrefs((p) => ({ ...p, densidade: v as Densidade }))
                }
              >
                <MenuItemRadio value="confortavel">
                  <Rows3 aria-hidden />
                  Confortável
                </MenuItemRadio>
                <MenuItemRadio value="compacta">
                  <Rows3 aria-hidden />
                  Compacta
                </MenuItemRadio>
              </MenuGrupoRadio>
            </MenuConteudo>
          </Menu>

          {nomeExportacao && (
            <Button
              variant="secundario"
              size="sm"
              disabled={!mostrandoDados}
              onClick={() =>
                exportarCsv({
                  // Exporta o que está filtrado e ordenado na tela inteira, não
                  // só a página. Quem filtrou "vencidos" quer os vencidos todos.
                  linhas: ordenadas,
                  colunas: visiveis,
                  nomeArquivo: nomeExportacao,
                })
              }
            >
              <Download aria-hidden />
              Exportar Excel
            </Button>
          )}

          {acoesTopo}
        </div>
      </div>

      {/* ------------------------------------------------------------ conteúdo */}
      {/* Sem `overflow-hidden`: ele criava um contexto de rolagem que anulava o
          `sticky` do cabeçalho, e a operadora perdia os títulos das colunas ao
          rolar os 46 lançamentos. O arredondamento agora sai do próprio filho. */}
      <div className="rounded-lg border border-borda bg-superficie">
        <p role="status" aria-live="polite" className="sr-only">
          {anuncio}
        </p>

        {erro ? (
          <EstadoErro aoTentarNovamente={aoTentarNovamente} />
        ) : carregando ? (
          <Esqueleto colunas={visiveis.length} padCelula={padCelula} />
        ) : total === 0 ? (
          termo ? (
            <EstadoVazio
              titulo="Nada encontrado"
              descricao={`Nenhum registro corresponde a "${termo}". Confira a escrita ou limpe a busca.`}
              acao={
                <Button variant="secundario" onClick={() => setTermo('')}>
                  Limpar busca
                </Button>
              }
            />
          ) : (
            <EstadoVazio
              titulo={vazio?.titulo}
              descricao={vazio?.descricao ?? 'Ainda não há nada cadastrado aqui.'}
              acao={vazio?.acao}
            />
          )
        ) : (
          <>
            {/* ---------------------------------------------- tabela (ponteiro) */}
            {/* Rola nos dois eixos, e é isto que faz o cabeçalho grudar de
                verdade: o `sticky` das células se ancora aqui. Enquanto só
                havia `overflow-x`, não existia rolagem vertical para grudar em
                nada — e o deslocamento acabava empurrando o cabeçalho por cima
                dos dados.

                Altura limitada pela viewport, e só isso — sem altura mínima. Um
                piso deixaria a tabela com 16rem de vazio embaixo quando houvesse
                duas linhas, e cadastro que começa do zero passa semanas assim. */}
            <div className="hidden max-h-[calc(100dvh-18rem)] overflow-auto rounded-t-lg md:block">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{legenda}</caption>
                <thead>
                  <tr className="border-b-2 border-borda-forte bg-superficie-afundada">
                    {visiveis.map((c) => {
                      const ativa = ordenacao?.chave === c.chave
                      const podeOrdenar = c.ordenavel !== false
                      return (
                        <th
                          key={c.chave}
                          scope="col"
                          aria-sort={
                            ativa
                              ? ordenacao!.direcao === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : podeOrdenar
                                ? 'none'
                                : undefined
                          }
                          style={c.larguraMin ? { minWidth: c.larguraMin } : undefined}
                          className={cn(
                            // `top-0`, e o motivo importa.
                            //
                            // Era `top-14`, mirando a barra superior de 3.5rem.
                            // Só que `sticky` se ancora no contêiner de rolagem
                            // mais próximo, e o `overflow-x-auto` do wrapper
                            // abaixo já é um. Esse wrapper não rola na vertical,
                            // então o deslocamento não grudava nada: empurrava o
                            // cabeçalho 56px para baixo, abrindo uma faixa vazia
                            // no topo e cobrindo as duas primeiras linhas. A
                            // tela parecia ter dois cabeçalhos embaralhados com
                            // os dados.
                            //
                            // Com `top-0` ele fica no lugar certo. Para o
                            // cabeçalho acompanhar a rolagem, quem precisa rolar
                            // é este wrapper — feito logo abaixo.
                            'sticky top-0 z-10 bg-superficie-afundada',
                            'border-b-2 border-borda-forte',
                            'text-2xs font-semibold uppercase tracking-wide text-texto-suave',
                            'whitespace-nowrap',
                            padCelula,
                            alinhar(c),
                          )}
                        >
                          {podeOrdenar ? (
                            <button
                              type="button"
                              onClick={() => alternarOrdem(c.chave)}
                              className={cn(
                                'group inline-flex items-center gap-1 rounded uppercase',
                                'hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                                ativa && 'text-acento-texto',
                                c.alinhamento === 'direita' || c.numerica
                                  ? 'flex-row-reverse'
                                  : '',
                              )}
                            >
                              {c.cabecalho}
                              {ativa ? (
                                ordenacao!.direcao === 'asc' ? (
                                  <ArrowUp className="size-3" aria-hidden />
                                ) : (
                                  <ArrowDown className="size-3" aria-hidden />
                                )
                              ) : (
                                <ArrowDownUp
                                  className="size-3 opacity-0 transition-opacity group-hover:opacity-60"
                                  aria-hidden
                                />
                              )}
                            </button>
                          ) : (
                            c.cabecalho
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {daPagina.map((linha) => {
                    const href = linkDaLinha?.(linha)
                    return (
                      <tr
                        key={chaveLinha(linha)}
                        className={cn(
                          'border-b border-borda last:border-b-0',
                          // Faixa alternada: 25 linhas de número em densidade
                          // compacta, só com divisória de 1px, não dão âncora
                          // horizontal nenhuma para o olho voltar.
                          'odd:bg-superficie-afundada/40',
                          'hover:bg-superficie-hover',
                          href && 'focus-within:bg-superficie-hover',
                        )}
                      >
                        {visiveis.map((c, i) => (
                          <td
                            key={c.chave}
                            className={cn(
                              padCelula,
                              alinhar(c),
                              c.numerica && 'tabular-nums',
                              i === 0 ? 'font-medium text-texto' : 'text-texto-suave',
                            )}
                          >
                            {/* A âncora fica na célula que IDENTIFICA a linha,
                                não no <tr>: linha não é elemento focável, e
                                envolver a tabela inteira em link quebra a
                                semântica de tabela. O ::after estende a área
                                clicável pela linha inteira.

                                Era sempre a primeira coluna. Deu errado assim
                                que Clientes ganhou "Código" na frente do nome:
                                o link virou o número, e quem clicava no nome do
                                cliente não abria nada. Agora segue a coluna
                                marcada como título — a mesma que vira o título
                                do cartão no celular. */}
                            {href && i === indiceTitulo ? (
                              <Link
                                href={href}
                                className="relative rounded after:absolute after:inset-y-0 after:-left-4 after:right-[-100vw] after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
                              >
                                {c.celula ? c.celula(linha) : c.texto(linha)}
                              </Link>
                            ) : c.celula ? (
                              c.celula(linha)
                            ) : (
                              c.texto(linha)
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ------------------------------------------------ cartões (toque) */}
            <ul className="divide-y divide-borda md:hidden">
              {daPagina.map((linha) => (
                <CartaoLinha
                  key={chaveLinha(linha)}
                  linha={linha}
                  colunas={visiveis}
                  href={linkDaLinha?.(linha)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------ rodapé */}
      {mostrandoDados && (
        <Paginacao
          inicio={inicio + 1}
          fim={Math.min(inicio + prefs.tamanhoPagina, total)}
          total={total}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          tamanhoPagina={prefs.tamanhoPagina}
          aoTrocarPagina={setPagina}
          aoTrocarTamanho={(n) => {
            setPrefs((p) => ({ ...p, tamanhoPagina: n }))
            setPagina(1)
          }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* peças internas                                                              */
/* -------------------------------------------------------------------------- */

function Esqueleto({ colunas, padCelula }: { colunas: number; padCelula: string }) {
  // Larguras alternadas em vez de todas iguais: bloco uniforme parece um erro
  // de renderização; irregular parece texto chegando.
  const larguras = ['70%', '45%', '85%', '55%', '60%']
  return (
    <div aria-hidden>
      <div className={cn('border-b border-borda bg-superficie-afundada', padCelula)}>
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 8 }).map((_, l) => (
        <div
          key={l}
          className={cn('flex gap-4 border-b border-borda last:border-b-0', padCelula)}
        >
          {Array.from({ length: Math.max(1, Math.min(colunas, 6)) }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-4 flex-1"
              style={{ maxWidth: larguras[(l + c) % larguras.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function CartaoLinha<T>({
  linha,
  colunas,
  href,
}: {
  linha: T
  colunas: Coluna<T>[]
  href?: string
}) {
  const titulo = colunas.find((c) => c.papelMobile === 'titulo') ?? colunas[0]
  const destaque = colunas.find((c) => c.papelMobile === 'destaque')
  const campos = colunas.filter(
    (c) =>
      c !== titulo &&
      c !== destaque &&
      c.papelMobile !== 'oculto' &&
      // Sem papel declarado a coluna aparece: esconder por omissão faria uma
      // coluna nova sumir do celular sem ninguém perceber.
      c.papelMobile !== 'titulo',
  )

  const conteudoTitulo = titulo.celula ? titulo.celula(linha) : titulo.texto(linha)

  return (
    <li className="relative px-4 py-3 has-[a:focus-visible]:bg-superficie-hover">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-base font-medium text-texto">
          {href ? (
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {conteudoTitulo}
            </Link>
          ) : (
            conteudoTitulo
          )}
        </p>
        {destaque && (
          <span
            className={cn(
              'shrink-0 text-base font-medium tabular-nums text-texto',
              destaque.numerica && 'tabular-nums',
            )}
          >
            {destaque.celula ? destaque.celula(linha) : destaque.texto(linha)}
          </span>
        )}
      </div>

      {campos.length > 0 && (
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-sm">
          {campos.map((c) => (
            <React.Fragment key={c.chave}>
              <dt className="text-texto-fraco">{c.cabecalho}</dt>
              <dd className={cn('text-texto-suave', c.numerica && 'tabular-nums')}>
                {c.celula ? c.celula(linha) : c.texto(linha)}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </li>
  )
}

function Paginacao({
  inicio,
  fim,
  total,
  pagina,
  totalPaginas,
  tamanhoPagina,
  aoTrocarPagina,
  aoTrocarTamanho,
}: {
  inicio: number
  fim: number
  total: number
  pagina: number
  totalPaginas: number
  tamanhoPagina: number
  aoTrocarPagina: (n: number) => void
  aoTrocarTamanho: (n: number) => void
}) {
  const idTamanho = React.useId()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-texto-suave">
      <p className="tabular-nums">
        Mostrando <span className="font-medium text-texto">{inicio}</span>–
        <span className="font-medium text-texto">{fim}</span> de{' '}
        <span className="font-medium text-texto">{total}</span>
      </p>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <label htmlFor={idTamanho} className="text-texto-fraco">
            Por página
          </label>
          <select
            id={idTamanho}
            value={tamanhoPagina}
            onChange={(e) => aoTrocarTamanho(Number(e.target.value))}
            className="h-8 rounded-md border border-borda-controle bg-superficie px-2 text-sm text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            {TAMANHOS_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {totalPaginas > 1 && (
          <nav aria-label="Paginação" className="flex items-center gap-1">
            <Button
              variant="secundario"
              size="icone"
              disabled={pagina === 1}
              onClick={() => aoTrocarPagina(pagina - 1)}
            >
              <ChevronLeft aria-hidden />
              <span className="sr-only">Página anterior</span>
            </Button>

            {paginasVisiveis(pagina, totalPaginas).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="px-1 text-texto-fraco" aria-hidden>
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === pagina ? 'primario' : 'fantasma'}
                  size="icone"
                  aria-current={p === pagina ? 'page' : undefined}
                  onClick={() => aoTrocarPagina(p)}
                >
                  <span className="tabular-nums">{p}</span>
                  <span className="sr-only">Página {p}</span>
                </Button>
              ),
            )}

            <Button
              variant="secundario"
              size="icone"
              disabled={pagina === totalPaginas}
              onClick={() => aoTrocarPagina(pagina + 1)}
            >
              <ChevronRight aria-hidden />
              <span className="sr-only">Próxima página</span>
            </Button>
          </nav>
        )}
      </div>
    </div>
  )
}

/** Primeira, última, e uma janela em volta da atual. `null` vira reticências. */
function paginasVisiveis(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const janela = new Set([1, total, atual, atual - 1, atual + 1])
  const ordenadas = [...janela].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const saida: (number | null)[] = []
  let anterior = 0
  for (const p of ordenadas) {
    if (anterior && p - anterior > 1) saida.push(null)
    saida.push(p)
    anterior = p
  }
  return saida
}
