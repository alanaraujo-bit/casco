import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeDollarSign,
  Boxes,
  CircleDollarSign,
  Droplets,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
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
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  BarraProgresso,
  GraficoArea,
  GraficoColunas,
  GraficoRosca,
} from '@/components/ui/graficos'
import {
  ATIVIDADE,
  CONTAS_RECEBER,
  ENTREGAS_SEMANA,
  FATURAMENTO_MENSAL,
  MIX_PRODUTOS,
  MOTIVOS_PERDA,
  RESUMO,
  TOP_CLIENTES,
  VASILHAME,
  type TipoAtividade,
} from '@/lib/demo'
import { moeda } from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel Gerencial' }

const ICONE_ATIVIDADE: Record<TipoAtividade, { Icone: LucideIcon; tom: Tom }> = {
  venda: { Icone: ShoppingCart, tom: 'acento' },
  vasilhame: { Icone: PackageCheck, tom: 'sucesso' },
  recebimento: { Icone: CircleDollarSign, tom: 'info' },
  cliente: { Icone: UserPlus, tom: 'roxo' },
  perda: { Icone: AlertTriangle, tom: 'perigo' },
}

export default function PainelGerencial() {
  const vencidas = CONTAS_RECEBER.filter((c) => c.situacao === 'Vencido').slice(0, 5)
  const maiorProduto = Math.max(...MIX_PRODUTOS.map((p) => p.valor))
  const maiorCliente = Math.max(...TOP_CLIENTES.map((c) => c.valor))

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Painel Gerencial"
        descricao="Quinta-feira, 30 de julho de 2026 · LM Distribuidora Natuclara"
        acoes={
          <>
            <Button variant="secundario" size="sm">
              Julho / 2026
            </Button>
            <Button variant="primario" size="sm" asChild>
              <Link href="/vendas/pdv">
                <ShoppingCart aria-hidden />
                Nova venda
              </Link>
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoKpi
          rotulo="Faturamento do mês"
          valor={moeda(RESUMO.faturamentoMes)}
          Icone={TrendingUp}
          tom="acento"
          variacao={
            <Variacao
              atual={RESUMO.faturamentoMes}
              anterior={RESUMO.faturamentoMesAnterior}
            />
          }
          detalhe="vs. junho"
          href="/relatorios/dre"
          grafico={
            <GraficoArea
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
          variacao={
            <Variacao atual={RESUMO.vendasHoje} anterior={RESUMO.vendasHojeAnterior} />
          }
          detalhe={`ticket médio ${moeda(RESUMO.ticketMedio)}`}
          href="/vendas/produtos"
          grafico={
            <GraficoColunas serie={ENTREGAS_SEMANA} altura={44} cor="var(--info)" />
          }
        />

        <CartaoKpi
          rotulo="A receber"
          valor={moeda(RESUMO.aReceber)}
          Icone={Wallet}
          tom="sucesso"
          detalhe={`${CONTAS_RECEBER.length} lançamentos em aberto`}
          href="/financeiro/receber"
        />

        <CartaoKpi
          rotulo="Vencido"
          valor={moeda(RESUMO.vencido)}
          Icone={AlertTriangle}
          tom="perigo"
          detalhe={`${RESUMO.vencidoQtd} títulos · cobrança pendente`}
          href="/financeiro/receber"
        />
      </div>

      {/* -------------------------------------------------- faixa do vasilhame */}
      {/* É o motivo da troca de sistema. Fica em destaque no painel de propósito:
          hoje esse número não existe em lugar nenhum — vira venda de centavos. */}
      <Card className="overflow-hidden border-acento-suave-borda">
        <div className="flex flex-col gap-4 bg-acento-suave/40 p-4 sm:flex-row sm:items-center">
          <Chip Icone={Droplets} tom="acento" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-texto">Controle de vasilhame</h2>
              <Badge variant="acento">exclusivo do Casco</Badge>
            </div>
            <p className="mt-0.5 text-xs text-texto-suave">
              Galão quebrado é custo de estoque, nunca receita. Aqui ele tem lugar
              próprio — e para de contaminar o faturamento.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-2xs uppercase tracking-wide text-texto-fraco">
                Perdas no mês
              </p>
              <p className="flex items-center gap-2 text-lg font-semibold tabular-nums text-texto">
                {VASILHAME.perdasMes} galões
                <Variacao
                  atual={VASILHAME.perdasMes}
                  anterior={VASILHAME.perdasMesAnterior}
                  bom="descer"
                />
              </p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wide text-texto-fraco">
                Custo das perdas
              </p>
              <p className="text-lg font-semibold tabular-nums text-texto">
                {moeda(VASILHAME.custoPerdasMes)}
              </p>
            </div>
            <Button variant="secundario" size="sm" asChild>
              <Link href="/vasilhame/baixa">
                <ArrowLeftRight aria-hidden />
                Lançar baixa
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ gráficos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Bloco
          titulo="Faturamento mês a mês"
          descricao="Últimos 12 meses · escala a partir do zero"
          href="/relatorios/caixa-mensal"
          className="lg:col-span-2"
        >
          <GraficoArea serie={FATURAMENTO_MENSAL} altura={200} formato="moeda" />
          <div className="mt-2 flex gap-1">
            {FATURAMENTO_MENSAL.map((p) => (
              <span
                key={p.rotulo}
                className="flex-1 text-center text-2xs text-texto-fraco"
              >
                {p.rotulo}
              </span>
            ))}
          </div>
        </Bloco>

        <Bloco
          titulo="Onde estão os galões"
          descricao="Vasilhame retornável, hoje"
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
              { rotulo: 'Na fábrica', valor: VASILHAME.naFabrica, cor: 'var(--cat-5)' },
            ]}
          />
        </Bloco>
      </div>

      {/* -------------------------------------------------------- ações rápidas */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AcaoRapida
          titulo="Nova venda"
          descricao="PDV do balcão"
          Icone={ShoppingCart}
          tom="acento"
          href="/vendas/pdv"
        />
        <AcaoRapida
          titulo="Baixa de vasilhame"
          descricao="Quebrado, trincado ou perdido"
          Icone={ArrowLeftRight}
          tom="alerta"
          href="/vasilhame/baixa"
        />
        <AcaoRapida
          titulo="Receber título"
          descricao="Baixa em Contas a Receber"
          Icone={BadgeDollarSign}
          tom="sucesso"
          href="/financeiro/receber"
        />
        <AcaoRapida
          titulo="Novo cliente"
          descricao="Cadastro com endereço"
          Icone={UserPlus}
          tom="roxo"
          href="/cadastro/clientes"
        />
      </div>

      {/* ---------------------------------------------------------- três blocos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Bloco
          titulo="Mais vendidos no mês"
          descricao="Em unidades"
          href="/estoque/saldo"
        >
          <div className="space-y-3">
            {MIX_PRODUTOS.map((p) => (
              <BarraProgresso
                key={p.rotulo}
                rotulo={p.rotulo}
                valor={p.valor}
                maximo={maiorProduto}
                cor={p.cor}
                formato="numero"
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

        <div className="space-y-3">
          <Bloco
            titulo="Cobrança em atraso"
            descricao={`${RESUMO.vencidoQtd} títulos vencidos`}
            href="/financeiro/receber"
          >
            <ul className="divide-y divide-borda">
              {vencidas.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-texto">{c.cliente}</p>
                    <p className="text-xs text-texto-fraco">venceu em {c.vencimento}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-perigo">
                    {moeda(c.valorTotal)}
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
          </Bloco>
        </div>
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

      {/* ------------------------------------------------------------- rodapé */}
      <p className="flex items-center justify-center gap-2 pb-2 text-2xs text-texto-fraco">
        <Boxes className="size-3" aria-hidden />
        Dados de demonstração. Os números viram os da LM assim que a migração rodar.
        <Truck className="size-3" aria-hidden />
      </p>
    </div>
  )
}
