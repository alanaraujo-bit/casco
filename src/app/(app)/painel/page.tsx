import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  BadgeDollarSign,
  Contact,
  Droplets,
  PhoneOff,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { AcaoRapida, CartaoKpi, Chip } from '@/components/painel/pecas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { exigirSessao } from '@/lib/dal'
import { resumoPainel } from '@/modules/painel/consultas'
import { moeda } from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel Gerencial' }

/**
 * Painel Gerencial.
 *
 * **Mostra só o que o banco sabe responder.** Faturamento do mês, vendas do
 * dia, mix de produtos e ranking de clientes saíram daqui: eles dependem da
 * Etapa 3 (Vendas), que ainda não existe. Enquanto não existir, esses cartões
 * seriam número inventado — e é assim que se perde a confiança do dono de uma
 * vez só: ele confere um contra a realidade, erra, e a partir daí não acredita
 * em mais nenhum número da tela.
 *
 * Conforme cada etapa entra, os blocos voltam — com dado de verdade.
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

  const semNada = r.clientes.total === 0 && r.receber.qtdAberto === 0

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Painel Gerencial"
        descricao={
          <>
            <span className="capitalize">{hojePorExtenso()}</span> · {sessao.empresa}
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
          {/* ------------------------------------------------------------- KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

            <CartaoKpi
              rotulo="Galões com clientes"
              valor={r.vasilhame.comClientes.toLocaleString('pt-BR')}
              Icone={Droplets}
              tom="cat-4"
              detalhe={
                r.vasilhame.clientesDevendo > 0
                  ? `com ${r.vasilhame.clientesDevendo} ${r.vasilhame.clientesDevendo === 1 ? 'cliente' : 'clientes'}`
                  : 'nenhum vasilhame na rua'
              }
              href="/cadastro/clientes"
            />
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
