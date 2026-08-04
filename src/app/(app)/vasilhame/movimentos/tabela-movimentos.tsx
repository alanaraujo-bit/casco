'use client'

import Link from 'next/link'
import { ArrowLeftRight, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDataHora } from '@/lib/formatos'
import { REGRA } from '@/modules/vasilhame/esquema'
import type { MovimentoLista } from '@/modules/vasilhame/consultas'
import { BotaoEstornar } from './botao-estornar'

function moeda(valor: string | number): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * O razão completo do vasilhame.
 *
 * A linha não é clicável de propósito, ao contrário das outras listagens: esta
 * tela tem uma ação destrutiva na última coluna, e "clicar na linha navega"
 * junto de "clicar no botão estorna" é como se estorna sem querer. Quem quer o
 * extrato do cliente clica no nome dele, que é um link explícito.
 */
const colunas: Coluna<MovimentoLista>[] = [
  {
    chave: 'criadoEm',
    cabecalho: 'Data',
    texto: (m) => formatarDataHora(m.criadoEm),
    valor: (m) => new Date(m.criadoEm),
    larguraMin: '9rem',
    papelMobile: 'campo',
  },
  {
    chave: 'motivo',
    cabecalho: 'Motivo',
    texto: (m) => REGRA[m.motivo].rotulo,
    celula: (m) => (
      <span className="flex items-center gap-1.5">
        <Badge variant={REGRA[m.motivo].tom}>{REGRA[m.motivo].rotulo}</Badge>
        {m.estornoDe && (
          <Badge variant="neutro" className="shrink-0">
            <Undo2 className="size-3" aria-hidden />
            estorno
          </Badge>
        )}
      </span>
    ),
    fixa: true,
    larguraMin: '11rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'cliente',
    cabecalho: 'Cliente',
    // Vazio aqui não é dado faltando — é movimento interno, e a tabela precisa
    // dizer isso em vez de mostrar um traço que parece cadastro incompleto.
    texto: (m) => m.cliente ?? 'Interno',
    celula: (m) =>
      m.cliente && m.clienteId ? (
        <Link
          href={`/vasilhame/saldos/${m.clienteId}`}
          className="text-acento-texto underline-offset-4 hover:underline"
        >
          {m.cliente}
        </Link>
      ) : (
        <span className="text-texto-fraco">Interno</span>
      ),
    larguraMin: '12rem',
  },
  {
    chave: 'produto',
    cabecalho: 'Vasilhame',
    texto: (m) => m.produto,
    larguraMin: '10rem',
  },
  {
    chave: 'quantidade',
    cabecalho: 'Qtd.',
    texto: (m) => (m.quantidade > 0 ? `+${m.quantidade}` : String(m.quantidade)),
    valor: (m) => m.quantidade,
    numerica: true,
    celula: (m) => (
      <span
        className={
          m.quantidade > 0
            ? 'font-medium tabular-nums text-info'
            : 'font-medium tabular-nums text-sucesso'
        }
      >
        {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
      </span>
    ),
    papelMobile: 'destaque',
  },
  {
    chave: 'custoPerda',
    cabecalho: 'Custo',
    texto: (m) => (Number(m.custoPerda) > 0 ? moeda(m.custoPerda) : '—'),
    valor: (m) => Number(m.custoPerda),
    numerica: true,
    celula: (m) =>
      Number(m.custoPerda) > 0 ? (
        // Vermelho porque é custo, e o ponto do módulo inteiro é que este número
        // nunca aparece como receita em lugar nenhum.
        <span className="tabular-nums text-perigo">{moeda(m.custoPerda)}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
  {
    chave: 'observacao',
    cabecalho: 'Observação',
    texto: (m) => m.observacao ?? '—',
    celula: (m) =>
      m.observacao ? (
        <span className="text-texto-suave">{m.observacao}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
    larguraMin: '14rem',
    ordenavel: false,
    ocultaPorPadrao: true,
  },
  {
    chave: 'usuario',
    cabecalho: 'Lançado por',
    texto: (m) => m.usuario ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'acoes',
    cabecalho: 'Correção',
    texto: () => '',
    celula: (m) =>
      // Estorno não se estorna: a linha de estorno não ganha botão. O caminho
      // para desfazer uma correção errada é lançar o movimento certo.
      m.estornoDe ? (
        <span className="text-xs text-texto-fraco">—</span>
      ) : (
        <BotaoEstornar id={m.id} estornado={m.estornado} />
      ),
    ordenavel: false,
    alinhamento: 'direita',
    larguraMin: '9rem',
  },
]

export function TabelaMovimentos({ linhas }: { linhas: MovimentoLista[] }) {
  return (
    <TabelaDados
      id="vasilhame-movimentos"
      legenda="Movimentos de vasilhame"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(m) => m.id}
      buscaPlaceholder="Buscar por motivo, cliente ou vasilhame…"
      nomeExportacao="vasilhame-movimentos"
      densidadePadrao="compacta"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/vasilhame/baixa">
            <ArrowLeftRight aria-hidden />
            Nova baixa
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum movimento lançado',
        descricao:
          'Cada entrega, devolução e perda de vasilhame aparece aqui, com o motivo e quem lançou.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/vasilhame/baixa">
              <ArrowLeftRight aria-hidden />
              Lançar o primeiro
            </Link>
          </Button>
        ),
      }}
    />
  )
}
