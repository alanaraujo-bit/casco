import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  BadgeDollarSign,
  Contact,
  Droplets,
  PhoneOff,
  Scale,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import {
  AcaoRapida,
  Bloco,
  CartaoKpi,
  Chip,
  Variacao,
  corDoTom,
  type Tom,
} from '@/components/painel/pecas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BarraProgresso, GraficoArea } from '@/components/ui/graficos'
import { exigirSessao } from '@/lib/dal'
import { resumoPainel } from '@/modules/painel/consultas'
import { mesCurto } from '@/modules/relatorios/periodo'
import { moeda } from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel Gerencial' }

/**
 * Painel Gerencial.
 *
 * **Mostra só o que o banco sabe responder.** Foi assim que esta tela nasceu,
 * sem faturamento nem vendas do dia, porque a Etapa 3 não existia e um cartão
 * com número inventado é pior que um cartão ausente — o dono confere um contra
 * a realidade, erra, e a partir daí não acredita em mais nenhum número.
 *
 * Agora eles existem, e voltaram: venda grava em seis tabelas numa transação,
 * o custo sai do estoque ao custo médio e a perda de vasilhame tem view
 * própria. O resultado do mês aqui é a **mesma conta do DRE**, lendo as mesmas
 * fontes — não uma segunda contabilidade escrita no painel, que é como se
 * chega a duas telas que discordam sobre o mesmo mês.
 *
 * O contraste com o que substituímos é literal: lá custos e despesas aparecem
 * como `0,00`, então Faturamento = Lucro Bruto = Lucro Líquido = R$ 86.134,08
 * — uma fábrica de água com custo zero (auditoria §4b).
 *
 * O que ainda não está aqui é **ranking de clientes**: exigiria decidir se
 * "melhor cliente" é quem compra mais ou quem paga em dia, e as duas respostas
 * mandam a operadora ligar para pessoas diferentes.
 */
function hojePorExtenso() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Belem',
  }).format(new Date())
}

export default async function PainelGerencial() {
  const [sessao, r] = await Promise.all([exigirSessao(), resumoPainel()])

  const faturamentoMes = Number(r.vendas.mes)
  const resultadoMes = Number(r.resultadoMes)
  const semNada =
    r.clientes.total === 0 && r.receber.qtdAberto === 0 && r.vendas.qtdMes === 0

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Painel Gerencial"
        descricao={
          <>
            {/* `first-letter` e não `capitalize`: este último maiúsculiza toda
                palavra e escrevia "Sábado, 01 De Agosto De 2026". E
                `inline-block` junto, porque `::first-letter` não se aplica a
                caixa inline. */}
            <span className="inline-block first-letter:uppercase">{hojePorExtenso()}</span> ·{' '}
            {sessao.empresa}
          </>
        }
      />

      {semNada ? (
        /* Primeiro acesso: um caminho, não um mural de zeros. Quatro cartões
           zerados não dizem à operadora o que fazer agora. */
        <Card className="p-6 text-center sm:p-10">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <Chip Icone={Contact} tom="acento" />
            <h2 className="text-base font-medium text-texto">
              O painel se preenche conforme você usa o sistema
            </h2>
            <p className="text-sm text-texto-suave">
              Comece cadastrando seus clientes. Os números de cobrança e de vasilhame
              aparecem aqui assim que houver lançamento.
            </p>
            <Button asChild variant="primario">
              <Link href="/cadastro/clientes/novo">
                <UserPlus aria-hidden />
                Cadastrar primeiro cliente
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* ------------------------------------------------------------- KPIs
              O faturamento vem primeiro porque é a primeira pergunta do dono.
              Ele saiu daqui enquanto a Etapa 3 não existia — número inventado
              é pior que cartão ausente — e volta agora com a venda gravando em
              seis tabelas numa transação.

              **Líquido de desconto, e não bruto.** O sistema deles soma o valor
              cheio, então o painel mostra um faturamento que ninguém recebeu.
              Aqui é o que entrou no acordo com o cliente; o desconto tem linha
              própria no DRE, para responder "quanto demos de desconto no mês". */}
          {/* Três colunas e não quatro: são seis cartões, que fecham 3+3 sem
              deixar buraco na última linha — e o cartão do faturamento, que
              carrega o gráfico, ganha a largura que ele precisa. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CartaoKpi
              rotulo="Faturamento do mês"
              valor={moeda(faturamentoMes)}
              Icone={TrendingUp}
              tom="acento"
              // Contra o mês anterior INTEIRO. Comparar 2 dias de agosto com os
              // 31 de julho renderia "−94%" todo dia 2, e uma variação que
              // sempre grita não é lida por ninguém no dia em que importa.
              variacao={
                <Variacao atual={faturamentoMes} anterior={Number(r.vendas.mesAnterior)} />
              }
              detalhe={`${r.vendas.qtdMes} ${r.vendas.qtdMes === 1 ? 'venda' : 'vendas'} · ticket ${moeda(Number(r.vendas.ticketMes))}`}
              href="/vendas/produtos"
              grafico={
                <GraficoArea
                  serie={r.serie.map((s) => ({ rotulo: mesCurto(s.mes), valor: s.valor }))}
                  titulo="Faturamento dos últimos seis meses"
                  formato="moeda"
                  altura={44}
                />
              }
            />

            <CartaoKpi
              rotulo="Vendido hoje"
              valor={moeda(Number(r.vendas.hoje))}
              Icone={ShoppingCart}
              tom="cat-6"
              detalhe={
                r.vendas.qtdHoje > 0
                  ? `${r.vendas.qtdHoje} ${r.vendas.qtdHoje === 1 ? 'venda fechada' : 'vendas fechadas'}`
                  : 'nenhuma venda ainda hoje'
              }
              href="/vendas/pdv"
            />

            <CartaoKpi
              rotulo="Resultado do mês"
              valor={moeda(resultadoMes)}
              Icone={resultadoMes >= 0 ? Scale : TrendingDown}
              // Só fica vermelho quando o mês fecha no negativo de verdade.
              tom={resultadoMes < 0 ? 'perigo' : 'cat-5'}
              detalhe={
                faturamentoMes > 0
                  ? `margem de ${((resultadoMes / faturamentoMes) * 100).toFixed(1).replace('.', ',')}%`
                  : 'sem faturamento no mês'
              }
              href="/relatorios/dre"
            />

            <CartaoKpi
              rotulo="A receber"
              valor={moeda(Number(r.receber.aberto))}
              Icone={Wallet}
              tom="sucesso"
              detalhe={`${r.receber.qtdAberto} ${r.receber.qtdAberto === 1 ? 'título em aberto' : 'títulos em aberto'}`}
              href="/financeiro/receber"
            />

            <CartaoKpi
              rotulo="Vencido"
              valor={moeda(Number(r.receber.vencido))}
              Icone={AlertTriangle}
              // Vermelho só quando há vencido de verdade. Alarme permanente em
              // R$ 0,00 some da vista numa semana, e aí não serve para o dia em
              // que houver.
              tom={r.receber.qtdVencido > 0 ? 'perigo' : 'cat-2'}
              detalhe={
                r.receber.qtdVencido > 0
                  ? `${r.receber.qtdVencido} ${r.receber.qtdVencido === 1 ? 'título' : 'títulos'} · cobrança pendente`
                  : 'nada em atraso'
              }
              href="/financeiro/receber"
            />

            <CartaoKpi
              rotulo="Clientes ativos"
              valor={r.clientes.total.toLocaleString('pt-BR')}
              Icone={Contact}
              tom="cat-1"
              detalhe={
                r.clientes.semTelefone > 0 ? (
                  <span className="inline-flex items-center gap-1 text-perigo">
                    <PhoneOff className="size-3.5" aria-hidden />
                    {r.clientes.semTelefone} sem telefone
                  </span>
                ) : (
                  'todos com telefone'
                )
              }
              href="/cadastro/clientes"
            />

            {/* "Galões com clientes" era o sétimo cartão aqui, e saiu: a faixa
                logo abaixo mostra o mesmo número com mais contexto. Repetir o
                dado a 200px de distância não dá ênfase, dá dúvida — o olho
                para para conferir se são a mesma coisa. */}
          </div>

          {/* -------------------------------------------- faixa do vasilhame */}
          {/* Só aparece quando há movimento de vasilhame. É o diferencial do
              produto, mas anunciar "R$ 0,00 de perda" antes de existir um único
              galão lançado é ruído, não argumento. */}
          {(r.vasilhame.comClientes > 0 || r.vasilhame.perdasMes > 0) && (
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
                      Galão quebrado é custo de estoque, nunca receita. A perda aparece
                      no DRE e não toca o fluxo de caixa — porque quando um galão
                      quebra, nenhum dinheiro sai da gaveta.
                    </p>
                  </div>
                </div>

                <dl className="grid shrink-0 grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <dt className="text-2xs text-texto-fraco">Perdas no mês</dt>
                    <dd className="text-lg font-semibold tabular-nums text-texto">
                      {r.vasilhame.perdasMes}
                    </dd>
                    <dd className="text-2xs text-texto-fraco">
                      {moeda(Number(r.vasilhame.custoPerdasMes))} de custo
                    </dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-texto-fraco">Clientes devendo</dt>
                    <dd className="text-lg font-semibold tabular-nums text-texto">
                      {r.vasilhame.clientesDevendo}
                    </dd>
                    <dd className="text-2xs text-texto-fraco">
                      {r.vasilhame.comClientes} galões na rua
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>
          )}

          {/* ----------------------------------------------- mix de produtos */}
          {/* Só com venda no mês. Um cartão "Mais vendidos" vazio no dia 1º
              ocupa a mesma altura para não dizer nada. */}
          {r.topProdutos.length > 0 && (
            <Bloco
              titulo="Mais vendidos no mês"
              descricao="por faturamento, entre os produtos que saíram"
              href="/vendas/produtos"
            >
              <ul className="space-y-3">
                {r.topProdutos.map((p, i) => (
                  <li key={p.nome}>
                    <BarraProgresso
                      rotulo={p.nome}
                      valor={Number(p.valor)}
                      maximo={Number(r.topProdutos[0].valor)}
                      formato="moeda"
                      // A cor separa as linhas sem afirmar nada sobre elas: a
                      // família categórica existe para isso. Verde no primeiro
                      // colocado sugeriria "este está bom", que é leitura que
                      // ninguém pediu.
                      cor={corDoTom(`cat-${(i % 6) + 1}` as Tom)}
                    />
                    <p className="mt-0.5 text-2xs text-texto-fraco">
                      {p.unidades.toLocaleString('pt-BR')}{' '}
                      {p.unidades === 1 ? 'unidade' : 'unidades'}
                    </p>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          {/* -------------------------------------------------- ações rápidas */}
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </>
      )}
    </div>
  )
}
