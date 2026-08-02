import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  EstadoErro,
  EstadoOffline,
  EstadoVazio,
  FaixaOffline,
  SemPermissao,
} from '@/components/ui/estados'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkeletonTabela } from '@/components/ui/skeleton'
import { moeda } from '@/lib/utils'

export const metadata: Metadata = { title: 'Design system' }

const ESCALA_ACENTO = [
  '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950',
]
/* Inclui 0 e 1000: são justamente `--fundo` e `--superficie`, as duas cores
   que cobrem quase toda a tela. Omiti-las tornaria a amostra inútil. */
const ESCALA_CINZA = [
  '0', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950', '1000',
]

/* Dados fictícios de propósito: esta página é pública, então nenhum nome ou
   documento de cliente real aparece aqui. */
const CONTAS = [
  { cliente: 'Depósito São Jorge', venc: '02/08/2026', valor: 1890, status: 'pago' },
  { cliente: 'Gás Central', venc: '04/08/2026', valor: 2375, status: 'pago' },
  { cliente: 'Mercado Bom Preço', venc: '08/08/2026', valor: 313.5, status: 'aberto' },
  { cliente: 'Disk Água Norte', venc: '09/08/2026', valor: 11362, status: 'aberto' },
  { cliente: 'Revenda Vale Verde', venc: '28/07/2026', valor: 997.5, status: 'vencido' },
  { cliente: 'Comercial Ipê', venc: '26/07/2026', valor: 85.5, status: 'vencido' },
] as const

const SELO = {
  pago: { variant: 'sucesso', texto: 'Pago' },
  aberto: { variant: 'alerta', texto: 'Em aberto' },
  vencido: { variant: 'perigo', texto: 'Vencido' },
} as const

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-texto">{titulo}</h2>
        <p className="text-xs text-texto-suave">{descricao}</p>
      </div>
      {children}
    </section>
  )
}

function Rampa({ escala, prefixo }: { escala: string[]; prefixo: string }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-borda">
      {escala.map((n) => (
        <div key={n} className="flex-1">
          <div
            className="h-14"
            style={{ backgroundColor: `var(--${prefixo}-${n})` }}
            aria-hidden
          />
          <div className="bg-superficie px-1 py-1 text-center text-2xs text-texto-fraco">
            {n}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borda pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-acento text-acento-contraste text-sm font-bold"
            >
              C
            </div>
            {/* h1: sem ele o outline desta página começava em h2, e a
                navegação por cabeçalho não tinha ponto de partida. */}
            <h1 className="text-xl font-semibold tracking-tight text-texto">
              Casco · Design system
            </h1>
          </div>
          <p className="text-xs text-texto-suave">
            Gestão para distribuidoras com vasilhame retornável
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Secao
        titulo="Acento — petróleo"
        descricao="Um acento só. Várias cores saturadas competindo destroem a hierarquia — o olho não sabe para onde ir."
      >
        <Rampa escala={ESCALA_ACENTO} prefixo="petroleo" />
      </Secao>

      <Secao
        titulo="Neutros"
        descricao="Carregam a interface inteira. Sub-tom frio: cinza puro fica morto ao lado de um acento saturado."
      >
        <Rampa escala={ESCALA_CINZA} prefixo="cinza" />
      </Secao>

      <Secao
        titulo="Semânticas"
        descricao="Só significam estado — nunca decoram. Cada par foi ajustado até passar 4.5:1 contra o próprio fundo, nos dois temas."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { nome: 'Sucesso', cor: 'bg-sucesso', bg: 'bg-sucesso-bg', txt: 'text-sucesso' },
            { nome: 'Alerta', cor: 'bg-alerta', bg: 'bg-alerta-bg', txt: 'text-alerta' },
            { nome: 'Perigo', cor: 'bg-perigo', bg: 'bg-perigo-bg', txt: 'text-perigo' },
            { nome: 'Info', cor: 'bg-info', bg: 'bg-info-bg', txt: 'text-info' },
          ].map((s) => (
            <div key={s.nome} className="overflow-hidden rounded-lg border border-borda">
              <div className={`h-10 ${s.cor}`} aria-hidden />
              <div className={`${s.bg} px-3 py-2`}>
                <span className={`text-xs font-medium ${s.txt}`}>{s.nome}</span>
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Tipografia"
        descricao="O corpo é sm (14px), não 16px — ferramenta de 8h quer ver mais linha. Piso em 12px, porque economizar pixel abaixo disso cobra caro de quem tem 45+ anos e monitor comum. Cada degrau tem tamanho próprio: dois nomes com o mesmo valor deixariam quem escolhe entre eles sem critério."
      >
        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-3xl font-semibold tracking-tight text-texto">
              Painel gerencial <span className="text-2xs text-texto-fraco">3xl · 30px</span>
            </p>
            <p className="text-xl font-semibold text-texto">
              Contas a Receber <span className="text-2xs text-texto-fraco">xl · 20px</span>
            </p>
            <p className="text-base text-texto">
              Campo no celular e texto de destaque{' '}
              <span className="text-2xs text-texto-fraco">base · 16px</span>
            </p>
            <p className="text-sm text-texto">
              Texto de corpo — o padrão da interface{' '}
              <span className="text-2xs text-texto-fraco">sm · 14px</span>
            </p>
            <p className="text-xs text-texto-suave">
              Texto secundário e rótulo de campo{' '}
              <span className="text-2xs text-texto-fraco">xs · 13px</span>
            </p>
            <p className="text-2xs text-texto-fraco uppercase tracking-wide">
              Rótulo de tabela · 2xs · 12px
            </p>
          </CardContent>
        </Card>
        <p className="text-2xs text-texto-fraco">
          <strong className="font-medium text-texto-suave">base é 16px de propósito:</strong>{' '}
          é o tamanho dos campos no celular, e abaixo de 16px o iOS dá zoom ao focar. O
          nome existe para essa função.
        </p>
      </Secao>

      <Secao
        titulo="Botões"
        descricao="Uma ação primária por tela. No celular todos nascem com 44px de altura; a partir de md ficam compactos."
      >
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 pt-4">
            <Button variant="primario">Registrar venda</Button>
            <Button variant="secundario">Cancelar</Button>
            <Button variant="suave">Filtrar</Button>
            <Button variant="fantasma">Limpar</Button>
            <Button variant="perigo">Excluir</Button>
            <Button variant="link">Ver extrato</Button>
            <Button variant="primario" disabled>
              Desabilitado
            </Button>
          </CardContent>
          <CardFooter className="flex-wrap">
            <Button size="sm">Pequeno</Button>
            <Button size="md">Médio</Button>
            <Button size="lg">Grande</Button>
            <Button size="toque" variant="primario">
              Toque (44px sempre)
            </Button>
          </CardFooter>
        </Card>
      </Secao>

      <Secao
        titulo="Campos"
        descricao="16px no celular por obrigação: abaixo disso o iOS dá zoom ao focar e a tela salta. A mensagem de erro sai do próprio componente, para o vínculo com o campo nunca ser esquecido."
      >
        <Card>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-cliente">Cliente</Label>
              <Input id="d-cliente" placeholder="Buscar por nome ou documento" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-valor">Valor</Label>
              <Input id="d-valor" type="number" defaultValue="1890.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-erro">Vencimento</Label>
              <Input
                id="d-erro"
                defaultValue="32/13/2026"
                erro="Data inválida — use o formato dia/mês/ano."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-off">Observação</Label>
              <Input id="d-off" disabled placeholder="Indisponível" />
            </div>
          </CardContent>
        </Card>
      </Secao>

      <Secao
        titulo="Selos de estado"
        descricao="Sempre com o rótulo escrito, nunca só cor — quem não distingue verde de vermelho precisa ler a palavra."
      >
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-4">
            <Badge variant="sucesso">Pago</Badge>
            <Badge variant="alerta">Em aberto</Badge>
            <Badge variant="perigo">Vencido</Badge>
            <Badge variant="info">Em rota</Badge>
            <Badge variant="acento">A Prazo</Badge>
            <Badge variant="neutro">Rascunho</Badge>
          </CardContent>
        </Card>
      </Secao>

      <Secao
        titulo="Estados"
        descricao="Carregando, vazio, erro, sem permissão e offline. Existem aqui para que nenhuma tela improvise o seu próprio — estado improvisado é como uma interface vira colcha de retalhos."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-borda">
              <CardTitle>Carregando</CardTitle>
            </CardHeader>
            <SkeletonTabela linhas={4} />
          </Card>

          <Card>
            <CardHeader className="border-b border-borda">
              <CardTitle>Vazio</CardTitle>
            </CardHeader>
            <EstadoVazio
              titulo="Nenhum lançamento em aberto"
              descricao="Quando houver conta a receber, ela aparece aqui."
              acao={<Button variant="primario">Novo lançamento</Button>}
            />
          </Card>

          <Card>
            <CardHeader className="border-b border-borda">
              <CardTitle>Erro</CardTitle>
            </CardHeader>
            <EstadoErro />
          </Card>

          <Card>
            <CardHeader className="border-b border-borda">
              <CardTitle>Sem permissão</CardTitle>
            </CardHeader>
            <SemPermissao recurso="abrir o PDV" />
          </Card>

          <Card className="overflow-hidden md:col-span-2">
            <CardHeader className="border-b border-borda">
              <CardTitle>Offline</CardTitle>
              <CardDescription>
                A faixa não interrompe a tarefa; a tela cheia é para quando não há
                o que mostrar.
              </CardDescription>
            </CardHeader>
            <FaixaOffline pendentes={3} />
            <EstadoOffline pendentes={3} />
          </Card>
        </div>
      </Secao>

      <Secao
        titulo="Tabela financeira"
        descricao="Algarismo tabular é inegociável: sem ele a coluna de valor treme entre linhas e a tabela parece amadora antes de o número ser lido."
      >
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-borda">
            <CardTitle>Contas a Receber</CardTitle>
            <CardDescription>
              Vocabulário do dia a dia da distribuidora, de propósito — a tela fala
              como a operadora fala.
            </CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            {/* min-w é o que faz o overflow-x realmente existir. Com apenas
                `w-full` a tabela se espreme em 360px, o nome do cliente quebra
                em três linhas e o alinhamento das colunas se perde. */}
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-borda bg-superficie-afundada text-left">
                  <th className="px-4 py-2 text-2xs font-medium uppercase tracking-wide text-texto-fraco">
                    Cliente
                  </th>
                  <th className="px-4 py-2 text-2xs font-medium uppercase tracking-wide text-texto-fraco">
                    Vencimento
                  </th>
                  <th className="px-4 py-2 text-right text-2xs font-medium uppercase tracking-wide text-texto-fraco">
                    Valor
                  </th>
                  <th className="px-4 py-2 text-2xs font-medium uppercase tracking-wide text-texto-fraco">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody>
                {CONTAS.map((c) => {
                  const selo = SELO[c.status]
                  return (
                    <tr
                      key={c.cliente}
                      className="border-b border-borda last:border-0 transition-colors hover:bg-superficie-hover"
                    >
                      <td className="px-4 py-2.5 font-medium text-texto">{c.cliente}</td>
                      <td className="px-4 py-2.5 text-texto-suave">{c.venc}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-texto">
                        {moeda(c.valor)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={selo.variant}>{selo.texto}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <CardFooter className="justify-between">
            <span className="text-xs text-texto-suave">6 de 6 lançamentos</span>
            <span className="text-sm font-semibold text-texto">
              {moeda(CONTAS.reduce((s, c) => s + c.valor, 0))}
            </span>
          </CardFooter>
        </Card>
        <p className="text-2xs text-texto-fraco">
          Em telas estreitas a tabela rola na horizontal. A partir da Etapa 0.6 ela
          ganha o modo Cards, mais legível no celular.
        </p>
      </Secao>

      <footer className="border-t border-borda pt-6 text-2xs text-texto-fraco">
        Casco · Aionix — Etapa 0.4 do roadmap. Alterne o tema no topo: claro e
        escuro são afinados separadamente, não invertidos.
      </footer>
    </div>
  )
}
