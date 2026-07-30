import type { Metadata } from 'next'
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  CircleDollarSign,
  Droplets,
  PackageCheck,
  PhoneOff,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import {
  AcaoRapida,
  Bloco,
  CartaoKpi,
  Chip,
  Variacao,
  type Tom,
} from '@/components/painel/pecas'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BotaoEmBreve } from '@/components/ui/em-breve'
import {
  BarraProgresso,
  GraficoArea,
  GraficoColunas,
  GraficoRosca,
} from '@/components/ui/graficos'
import {
  ATIVIDADE,
  CLIENTES_SUMIDOS,
  CONTAS_RECEBER,
  CUSTO_VASILHAME,
  FATURAMENTO_MENSAL,
  MIX_PRODUTOS,
  MOTIVOS_PERDA,
  RESUMO,
  TOP_CLIENTES,
  VASILHAME,
  VENDAS_7_DIAS,
  type TipoAtividade,
} from '@/lib/demo'
import { moeda } from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel Gerencial' }

// A data do cabeçalho é calculada, não escrita no código. Estava literal
// ("Quinta-feira, 30 de julho") e afirmaria o dia da semana errado no dia
// seguinte — na frente do cliente. De hora em hora basta.
export const revalidate = 3600

const ICONE_ATIVIDADE: Record<TipoAtividade, { Icone: LucideIcon; tom: Tom }> = {
  venda: { Icone: ShoppingCart, tom: 'acento' },
  vasilhame: { Icone: PackageCheck, tom: 'sucesso' },
  recebimento: { Icone: CircleDollarSign, tom: 'info' },
  cliente: { Icone: UserPlus, tom: 'roxo' },
  perda: { Icone: AlertTriangle, tom: 'perigo' },
}

function hojePorExtenso() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Belem',
  }).format(new Date())
}

export default function PainelGerencial() {
  const vencidas = CONTAS_RECEBER.filter((c) => c.situacao === 'Vencido')
    .sort((a, b) => b.valorParcela - a.valorParcela)
    .slice(0, 5)

  const maiorReceita = Math.max(...MIX_PRODUTOS.map((p) => p.receita))
  const maiorCliente = Math.max(...TOP_CLIENTES.map((c) => c.valor))
  const totalGaloes =
    VASILHAME.emPoderDeClientes + VASILHAME.noDeposito + VASILHAME.naFabrica

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Painel Gerencial"
        descricao={
          <>
            <span className="capitalize">{hojePorExtenso()}</span> · LM Distribuidora
            Natuclara
          </>
        }
        acoes={
          <>
            <span className="hidden rounded-md border border-borda bg-superficie px-2.5 py-1.5 text-xs font-medium text-texto-suave sm:inline-block">
              Julho / 2026 · mês em curso
            </span>
            <BotaoEmBreve
              titulo="PDV — venda de balcão"
              descricao="A tela de venda é a Etapa 3 do plano. É o que ela vai fazer:"
              itens={[
                'Venda em até 3 toques: cliente, produto, forma de pagamento',
                'Preço automático por tipo de cliente (revenda, mercado, consumidor)',
                'Devolução de vasilhame lançada na mesma tela da venda',
                'Venda avulsa de balcão, sem obrigar cadastro',
                'Comprovante impresso ou enviado por WhatsApp',
              ]}
            >
              <ShoppingCart aria-hidden />
              Nova venda
            </BotaoEmBreve>
          </>
        }
      />

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoKpi
          rotulo="Faturamento de julho"
          valor={moeda(RESUMO.faturamentoMes)}
          Icone={TrendingUp}
          tom="acento"
          variacao={
            <Variacao
              atual={RESUMO.faturamentoMes}
              anterior={RESUMO.faturamentoMesAnterior}
            />
          }
          detalhe="vs. junho fechado"
          href="/relatorios/dre"
          grafico={
            <GraficoArea
              titulo="Faturamento dos últimos 7 meses"
              serie={FATURAMENTO_MENSAL.slice(-7)}
              altura={44}
              formato="moeda"
            />
          }
        />

        <CartaoKpi
          rotulo="Vendas hoje"
          valor={String(RESUMO.vendasHoje)}
          Icone={ShoppingCart}
          tom="info"
          variacao={<Variacao atual={RESUMO.vendasHoje} anterior={RESUMO.vendasOntem} />}
          detalhe="vs. ontem"
          href="/vendas/produtos"
          grafico={
            <GraficoColunas
              titulo="Vendas dos últimos 7 dias"
              serie={VENDAS_7_DIAS}
              altura={40}
              cor="var(--info)"
              destacarUltima
            />
          }
        />

        <CartaoKpi
          rotulo="A receber"
          valor={moeda(RESUMO.aReceber)}
          Icone={Wallet}
          tom="sucesso"
          detalhe={`${RESUMO.aReceberQtd} títulos em aberto`}
          href="/financeiro/receber"
          grafico={
            // Para-brisa, não retrovisor: "vencido" diz o que já deu errado;
            // isto diz o que ainda dá para evitar.
            <div className="space-y-1.5 pt-1">
              {[
                { r: 'Vence hoje', v: RESUMO.venceHoje, c: 'var(--alerta)' },
                { r: 'Até 7 dias', v: RESUMO.venceEm7, c: 'var(--info)' },
                { r: 'Até 30 dias', v: RESUMO.venceEm30, c: 'var(--sucesso)' },
              ].map((f) => (
                <div key={f.r} className="flex items-center gap-2 text-2xs">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: f.c }}
                    aria-hidden
                  />
                  <span className="flex-1 text-texto-fraco">{f.r}</span>
                  <span className="font-medium tabular-nums text-texto-suave">{f.v}</span>
                </div>
              ))}
            </div>
          }
        />

        <CartaoKpi
          rotulo="Vencido"
          valor={moeda(RESUMO.vencido)}
          Icone={AlertTriangle}
          tom="perigo"
          detalhe={`${RESUMO.vencidoQtd} títulos · cobrança pendente`}
          href="/financeiro/receber"
          grafico={
            <ul className="space-y-1 pt-1">
              {vencidas.slice(0, 3).map((c) => (
                <li key={c.id} className="flex gap-2 text-2xs">
                  <span className="min-w-0 flex-1 truncate text-texto-fraco">
                    {c.cliente}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-perigo">
                    {moeda(c.valorParcela)}
                  </span>
                </li>
              ))}
            </ul>
          }
        />
      </div>

      {/* -------------------------------------------------- faixa do vasilhame */}
      {/* O motivo da troca de sistema, em destaque de propósito: nenhum destes
          três números existe no Fature Gestão. O patrimônio na rua é o que ERP
          genérico nenhum calcula — e é o argumento da conversa. */}
      <Card className="border-acento-suave-borda">
        <div className="flex flex-col gap-4 rounded-lg bg-acento-suave/40 p-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Chip Icone={Droplets} tom="acento" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-texto">
                  Controle de vasilhame
                </h2>
                <Badge variant="acento">só no Casco</Badge>
              </div>
              <p className="mt-0.5 max-w-[54ch] text-xs text-texto-suave">
                Galão quebrado é custo de estoque, nunca receita. No sistema atual as{' '}
                {VASILHAME.perdasMes} baixas deste mês viravam{' '}
                <strong className="font-medium text-texto">
                  {moeda(VASILHAME.receitaFalsaNoLegado)}
                </strong>{' '}
                de venda falsa — porque não havia onde lançá-las.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 items-start gap-x-6 gap-y-3 sm:grid-cols-3 lg:shrink-0">
            <div>
              <dt className="text-2xs uppercase tracking-wide text-texto-fraco">
                Patrimônio na rua
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-texto">
                {moeda(VASILHAME.patrimonioNaRua)}
              </dd>
              <dd className="text-2xs text-texto-fraco">
                {VASILHAME.emPoderDeClientes.toLocaleString('pt-BR')} galões ×{' '}
                {moeda(CUSTO_VASILHAME)}
              </dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wide text-texto-fraco">
                Perdas no mês
              </dt>
              <dd className="flex flex-wrap items-center gap-1.5 text-lg font-semibold tabular-nums text-texto">
                {VASILHAME.perdasMes}
                <Variacao
                  atual={VASILHAME.perdasMes}
                  anterior={VASILHAME.perdasMesAnterior}
                  bom="descer"
                />
              </dd>
              <dd className="text-2xs text-texto-fraco">
                {moeda(VASILHAME.custoPerdasMes)} de custo
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-1 sm:self-center">
              <BotaoEmBreve
                variant="secundario"
                titulo="Baixa de vasilhame"
                descricao="É a tela que não existe no sistema atual. Etapa 2 do plano:"
                itens={[
                  'Motivo obrigatório: quebrado, trincado, perdido ou não devolvido',
                  'Vira custo de estoque — nunca aparece como receita',
                  'Saldo por cliente atualizado na hora',
                  'Relatório de perdas por motivo, por mês e por entregador',
                ]}
              >
                <ArrowLeftRight aria-hidden />
                Lançar baixa
              </BotaoEmBreve>
            </div>
          </dl>
        </div>
      </Card>

      {/* ------------------------------------------------------------ gráficos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Bloco
          titulo="Faturamento mês a mês"
          descricao="12 meses · julho ainda em curso"
          href="/relatorios/caixa-mensal"
          className="lg:col-span-2"
        >
          <GraficoArea
            titulo="Faturamento dos últimos 12 meses"
            serie={FATURAMENTO_MENSAL}
            altura={190}
            formato="moeda"
            eixo
          />
        </Bloco>

        <Bloco
          titulo="Onde estão os galões"
          descricao={`${totalGaloes.toLocaleString('pt-BR')} vasilhames no total`}
          href="/vasilhame/saldos"
        >
          <GraficoRosca
            titulo="Distribuição do vasilhame retornável"
            totalRotulo="galões"
            fatias={[
              {
                rotulo: 'Com clientes',
                valor: VASILHAME.emPoderDeClientes,
                cor: 'var(--cat-1)',
              },
              { rotulo: 'No depósito', valor: VASILHAME.noDeposito, cor: 'var(--cat-4)' },
              {
                rotulo: 'Na fábrica (higienização)',
                valor: VASILHAME.naFabrica,
                cor: 'var(--cat-5)',
              },
            ]}
          />
        </Bloco>
      </div>

      {/* -------------------------------------------------------- ações rápidas */}
      {/* Cor categórica, não semântica: verde em "Receber título" sugeriria que
          algo foi recebido, e âmbar em "Baixa de vasilhame" sugeriria alerta. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AcaoRapida
          titulo="Receber título"
          descricao="Baixa em Contas a Receber"
          Icone={BadgeDollarSign}
          tom="cat-4"
          href="/financeiro/receber"
        />
        <AcaoRapida
          titulo="Clientes"
          descricao="Cadastro, contato e vasilhame"
          Icone={UserPlus}
          tom="cat-3"
          href="/cadastro/clientes"
        />
        <AcaoRapida
          titulo="Baixa de vasilhame"
          descricao="Quebrado, trincado ou perdido"
          Icone={ArrowLeftRight}
          tom="cat-5"
          href="/vasilhame/baixa"
          emBreve
        />
        <AcaoRapida
          titulo="PDV"
          descricao="Venda de balcão"
          Icone={ShoppingCart}
          tom="cat-2"
          href="/vendas/pdv"
          emBreve
        />
      </div>

      {/* ---------------------------------------------------------- três blocos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Bloco
          titulo="Mais vendidos no mês"
          descricao="Em receita — não em unidade"
          href="/estoque/saldo"
        >
          <div className="space-y-3">
            {MIX_PRODUTOS.map((p) => (
              <BarraProgresso
                key={p.rotulo}
                rotulo={`${p.rotulo} · ${p.unidades.toLocaleString('pt-BR')} un`}
                valor={p.receita}
                maximo={maiorReceita}
                cor={p.cor}
                formato="moeda"
              />
            ))}
          </div>
        </Bloco>

        <Bloco titulo="Movimentação recente" descricao="Últimas horas">
          <ul className="space-y-3">
            {ATIVIDADE.map((a) => {
              const { Icone, tom } = ICONE_ATIVIDADE[a.tipo]
              return (
                <li key={a.id} className="flex gap-3">
                  <Chip Icone={Icone} tom={tom} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto">{a.titulo}</p>
                    <p className="truncate text-xs text-texto-suave">{a.detalhe}</p>
                  </div>
                  <span className="shrink-0 text-2xs text-texto-fraco">{a.quando}</span>
                </li>
              )
            })}
          </ul>
        </Bloco>

        {/* O sistema atual não responde "quem sumiu esse mês" — está na
            auditoria §1.1 como a pergunta que o dono não consegue fazer. */}
        <Bloco
          titulo="Clientes que pararam de comprar"
          descricao="Mais de 15 dias sem pedido"
          href="/cadastro/clientes"
          hrefRotulo="Ver clientes"
        >
          <ul className="divide-y divide-borda">
            {CLIENTES_SUMIDOS.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-texto">{c.nome}</p>
                  <p className="truncate text-xs text-texto-suave">
                    {c.bairro} · {c.vasilhames} galões com ele
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums text-alerta">
                    {c.diasSemComprar} dias
                  </p>
                  {!c.telefone && (
                    <p className="flex items-center justify-end gap-1 text-2xs text-texto-fraco">
                      <PhoneOff className="size-3" aria-hidden />
                      sem telefone
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Bloco>
      </div>

      {/* ------------------------------------------------- cobrança e perdas */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Bloco
          titulo="Cobrança em atraso"
          descricao={`${RESUMO.vencidoQtd} títulos · ${moeda(RESUMO.vencido)} no total`}
          href="/financeiro/receber"
          className="lg:col-span-2"
        >
          <ul className="divide-y divide-borda">
            {vencidas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-texto">{c.cliente}</p>
                  <p className="truncate text-xs text-texto-fraco">
                    venceu em {c.vencimento} · parcela {c.parcela} · {c.formaPagamento}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-perigo">
                  {moeda(c.valorParcela)}
                </span>
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco titulo="Por que perdemos galão" descricao="Motivos no mês">
          <div className="space-y-3">
            {MOTIVOS_PERDA.map((m) => (
              <BarraProgresso
                key={m.rotulo}
                rotulo={m.rotulo}
                valor={m.valor}
                maximo={Math.max(...MOTIVOS_PERDA.map((x) => x.valor))}
                cor={m.cor}
              />
            ))}
          </div>
          <p className="mt-3 border-t border-borda pt-3 text-xs text-texto-suave">
            Cada galão custa {moeda(CUSTO_VASILHAME)} para repor.
          </p>
        </Bloco>
      </div>

      {/* ------------------------------------------------------- top clientes */}
      <Bloco
        titulo="Maiores clientes do mês"
        descricao="Por faturamento"
        href="/cadastro/clientes"
      >
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {TOP_CLIENTES.map((c) => (
            <BarraProgresso
              key={c.nome}
              rotulo={c.nome}
              valor={c.valor}
              maximo={maiorCliente}
              cor={c.cor}
              formato="moeda"
            />
          ))}
        </div>
      </Bloco>

      <p className="pb-2 text-center text-2xs text-texto-fraco">
        Dados de demonstração, na escala real da operação. Viram os números da LM
        quando a migração rodar.
      </p>
    </div>
  )
}
