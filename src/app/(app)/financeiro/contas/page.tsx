import type { Metadata } from 'next'
import Link from 'next/link'
import { CreditCard, Landmark, Pencil, Plus } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn, moeda } from '@/lib/utils'
import { alternarConta, alternarForma } from '@/modules/financeiro/acoes'
import { listarContasCadastro, listarFormasCadastro } from '@/modules/financeiro/consultas'
import { ROTULO_TIPO_PAGAMENTO } from '@/modules/financeiro/esquema'
import { BotaoAtivoMeio } from './botao-ativo-meio'

export const metadata: Metadata = { title: 'Contas e Formas' }

/**
 * Contas bancárias e formas de pagamento.
 *
 * **A tela que faltava para a Etapa 4 fechar.** As duas tabelas existiam desde
 * a migration 0006 e só eram escritas pelo `scripts/criar-empresa.mjs`, no dia
 * em que a distribuidora nascia. Abrir uma conta, trocar de maquininha ou
 * renegociar a taxa do débito exigia um desenvolvedor.
 *
 * A auditoria mostra aonde isso leva (§4e): no sistema deles existem contas
 * chamadas `RETROATIVO CAIXA ECONOMICA` e formas `PIX RETROATIVO`, inventadas
 * para contornar um cadastro que não deixava corrigir nada. O usuário não
 * estava errado — o sistema é que não deixava.
 *
 * **As duas coisas moram na mesma tela** porque uma aponta para a outra: a
 * forma de pagamento diz em qual conta o dinheiro cai. Separadas em dois itens
 * de menu, essa relação vira algo que se descobre errando.
 */
export default async function PaginaContasEFormas() {
  const [contas, formas] = await Promise.all([listarContasCadastro(), listarFormasCadastro()])

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Contas e Formas de Pagamento"
        descricao="Onde o dinheiro cai, e quanto a maquininha desconta no caminho"
      />

      {/* ------------------------------------------------ contas bancárias */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Landmark className="size-4 shrink-0 text-texto-fraco" aria-hidden />
            <h2 className="text-sm font-semibold text-texto">Contas Bancárias</h2>
          </div>
          <Button asChild variant="secundario" size="sm">
            <Link href="/financeiro/contas/nova">
              <Plus aria-hidden />
              Nova conta
            </Link>
          </Button>
        </div>

        <ul className="divide-y divide-borda/60">
          {contas.map((c) => (
            <li
              key={c.id}
              className={cn(
                'flex flex-wrap items-center gap-3 px-4 py-3',
                !c.ativo && 'bg-superficie-afundada/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/financeiro/contas/${c.id}`}
                    className="truncate text-sm font-medium text-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
                  >
                    {c.nome}
                  </Link>
                  <Badge variant={c.tipo === 'caixa' ? 'acento' : 'neutro'}>
                    {c.tipo === 'caixa' ? 'caixa' : 'banco'}
                  </Badge>
                  {!c.ativo && <Badge variant="perigo">desativada</Badge>}
                </div>
                <p className="mt-0.5 text-2xs text-texto-fraco">
                  saldo inicial{' '}
                  <span className="tabular-nums">{moeda(Number(c.saldoInicial))}</span>
                  {c.movimentos > 0 && ` · ${c.movimentos} movimentos`}
                  {c.formas > 0 &&
                    ` · ${c.formas} ${c.formas === 1 ? 'forma aponta' : 'formas apontam'} para ela`}
                </p>
              </div>

              <Button asChild variant="fantasma" size="sm">
                <Link href={`/financeiro/contas/${c.id}`}>
                  <Pencil aria-hidden />
                  Editar
                </Link>
              </Button>
              <BotaoAtivoMeio id={c.id} ativo={c.ativo} acao={alternarConta} />
            </li>
          ))}
        </ul>
      </Card>

      {/* --------------------------------------------- formas de pagamento */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <CreditCard className="size-4 shrink-0 text-texto-fraco" aria-hidden />
            <h2 className="text-sm font-semibold text-texto">Formas de Pagamento</h2>
          </div>
          <Button asChild variant="secundario" size="sm">
            <Link href="/financeiro/formas/nova">
              <Plus aria-hidden />
              Nova forma
            </Link>
          </Button>
        </div>

        <ul className="divide-y divide-borda/60">
          {formas.map((f) => {
            const taxa = Number(f.taxaPercentual)
            return (
              <li
                key={f.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-4 py-3',
                  !f.ativo && 'bg-superficie-afundada/40',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/financeiro/formas/${f.id}`}
                      className="truncate text-sm font-medium text-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
                    >
                      {f.nome}
                    </Link>
                    <Badge variant="neutro">{ROTULO_TIPO_PAGAMENTO[f.tipo] ?? f.tipo}</Badge>
                    {/* A taxa só ganha selo quando existe. Um "0,00%" em toda
                        linha faria o olho parar de procurar o número que
                        importa — que é justamente o das duas que descontam. */}
                    {taxa > 0 && (
                      <Badge variant="alerta">
                        {taxa.toFixed(2).replace('.', ',')}% de taxa
                      </Badge>
                    )}
                    {!f.ativo && <Badge variant="perigo">desativada</Badge>}
                  </div>
                  <p className="mt-0.5 text-2xs text-texto-fraco">
                    {f.conta ? `cai em ${f.conta}` : 'sem conta definida'}
                    {f.prazoDias > 0 && ` · em ${f.prazoDias} ${f.prazoDias === 1 ? 'dia' : 'dias'}`}
                    {f.usos > 0 && ` · usada em ${f.usos} ${f.usos === 1 ? 'venda' : 'vendas'}`}
                  </p>
                </div>

                <Button asChild variant="fantasma" size="sm">
                  <Link href={`/financeiro/formas/${f.id}`}>
                    <Pencil aria-hidden />
                    Editar
                  </Link>
                </Button>
                <BotaoAtivoMeio id={f.id} ativo={f.ativo} acao={alternarForma} />
              </li>
            )
          })}
        </ul>
      </Card>

      <p className="text-2xs leading-relaxed text-texto-fraco">
        Nada aqui se apaga, só se desativa: conta e forma são apontadas por vendas, títulos e
        movimentos de caixa já lançados. Desativar tira do PDV e das telas de baixa, e preserva o
        histórico do que já aconteceu.
      </p>
    </div>
  )
}
