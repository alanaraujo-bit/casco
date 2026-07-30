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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { moeda } from '@/lib/utils'

export const metadata: Metadata = { title: 'Design system' }

const ESCALA = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

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
            <span className="text-xl font-semibold tracking-tight text-texto">Casco</span>
          </div>
          <p className="text-xs text-texto-suave">
            Design system · gestão para distribuidoras com vasilhame retornável
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Secao
        titulo="Acento — petróleo"
        descricao="Um acento só. O sistema antigo usa cinco cores saturadas competindo, e é por isso que nada tem hierarquia."
      >
        <div className="flex overflow-hidden rounded-lg border border-borda">
          {ESCALA.map((n) => (
            <div key={n} className="flex-1">
              <div
                className="h-14"
                style={{ backgroundColor: `var(--petroleo-${n})` }}
                aria-hidden
              />
              <div className="bg-superficie px-1 py-1 text-center text-2xs text-texto-fraco">
                {n}
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Neutros"
        descricao="Carregam a interface inteira. Sub-tom frio: cinza puro fica morto ao lado de um acento saturado."
      >
        <div className="flex overflow-hidden rounded-lg border border-borda">
          {ESCALA.map((n) => (
            <div key={n} className="flex-1">
              <div
                className="h-14"
                style={{ backgroundColor: `var(--cinza-${n})` }}
                aria-hidden
              />
              <div className="bg-superficie px-1 py-1 text-center text-2xs text-texto-fraco">
                {n}
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Semânticas"
        descricao="Só significam estado — nunca decoram. Verde é pago, âmbar é pendente, vermelho é vencido ou quebrado."
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
        descricao="Corpo em 13px, não 16px. Quem passa 8h na tela quer ver mais linha, não texto maior."
      >
        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-3xl font-semibold tracking-tight text-texto">
              Painel gerencial
            </p>
            <p className="text-xl font-semibold text-texto">Contas a receber</p>
            <p className="text-base text-texto">
              Texto de corpo — o tamanho padrão da interface.
            </p>
            <p className="text-sm text-texto-suave">
              Texto secundário, usado em apoio e descrição.
            </p>
            <p className="text-2xs text-texto-fraco uppercase tracking-wide">
              Rótulo de tabela
            </p>
          </CardContent>
        </Card>
      </Secao>

      <Secao titulo="Botões" descricao="Uma ação primária por tela. O resto é secundário ou fantasma.">
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
              Toque (44px)
            </Button>
          </CardFooter>
        </Card>
      </Secao>

      <Secao
        titulo="Campos"
        descricao="16px no celular por obrigação: abaixo disso o iOS dá zoom ao focar e a tela salta."
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
              <Input id="d-erro" aria-invalid defaultValue="32/13/2026" />
              <p className="text-2xs text-perigo">Data inválida.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-off">Observação</Label>
              <Input id="d-off" disabled placeholder="Indisponível" />
            </div>
          </CardContent>
        </Card>
      </Secao>

      <Secao titulo="Selos de estado" descricao="Se aparecer um selo sem estado por trás, está sendo usado errado.">
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-4">
            <Badge variant="sucesso">Pago</Badge>
            <Badge variant="alerta">Em aberto</Badge>
            <Badge variant="perigo">Vencido</Badge>
            <Badge variant="info">Em rota</Badge>
            <Badge variant="acento">Fiado</Badge>
            <Badge variant="neutro">Rascunho</Badge>
          </CardContent>
        </Card>
      </Secao>

      <Secao
        titulo="Tabela financeira"
        descricao="Algarismo tabular é inegociável: sem ele a coluna de valor treme entre linhas e a tabela parece amadora antes de o número ser lido."
      >
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-borda">
            <CardTitle>Contas a Receber</CardTitle>
            <CardDescription>Vocabulário do sistema antigo, de propósito — o usuário não pode se perder ao trocar.</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
      </Secao>

      <footer className="border-t border-borda pt-6 text-2xs text-texto-fraco">
        Casco · Aionix — Etapa 0.4 do roadmap. Alterne o tema no topo: claro e
        escuro são afinados separadamente, não invertidos.
      </footer>
    </div>
  )
}
