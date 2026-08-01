'use client'

import { Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDataHora } from '@/lib/formatos'
import { REGRA } from '@/modules/vasilhame/esquema'
import type { LinhaExtrato } from '@/modules/vasilhame/consultas'

/**
 * O extrato auditável, galão a galão.
 *
 * A coluna que justifica a tela é `saldoApos`: sem ela o cliente vê uma lista
 * de eventos e tem que somar de cabeça para conferir o número que está sendo
 * cobrado dele. Com ela, dá para apontar a linha exata onde o saldo virou o que
 * é — que é a diferença entre uma cobrança discutível e uma cobrança explicada.
 */
const colunas: Coluna<LinhaExtrato>[] = [
  {
    chave: 'criadoEm',
    cabecalho: 'Data',
    texto: (l) => formatarDataHora(l.criadoEm),
    valor: (l) => new Date(l.criadoEm),
    larguraMin: '9rem',
    papelMobile: 'campo',
  },
  {
    chave: 'motivo',
    cabecalho: 'Motivo',
    texto: (l) => REGRA[l.motivo].rotulo,
    celula: (l) => (
      <span className="flex items-center gap-1.5">
        <Badge variant={REGRA[l.motivo].tom}>{REGRA[l.motivo].rotulo}</Badge>
        {l.estornoDe && (
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
    chave: 'produto',
    cabecalho: 'Vasilhame',
    texto: (l) => l.produto,
    larguraMin: '10rem',
  },
  {
    chave: 'quantidade',
    cabecalho: 'Qtd.',
    texto: (l) => (l.quantidade > 0 ? `+${l.quantidade}` : String(l.quantidade)),
    valor: (l) => l.quantidade,
    numerica: true,
    celula: (l) => (
      // O sinal explícito no positivo não é enfeite: numa coluna onde metade
      // dos valores é negativo, `3` e `-3` se confundem em leitura rápida, e é
      // exatamente essa confusão que a tela existe para desfazer.
      <span
        className={
          l.quantidade > 0 ? 'font-medium tabular-nums text-info' : 'font-medium tabular-nums text-sucesso'
        }
      >
        {l.quantidade > 0 ? `+${l.quantidade}` : l.quantidade}
      </span>
    ),
    papelMobile: 'destaque',
  },
  {
    chave: 'saldoApos',
    cabecalho: 'Saldo',
    texto: (l) => String(l.saldoApos),
    valor: (l) => l.saldoApos,
    numerica: true,
    celula: (l) => (
      <span className="font-semibold tabular-nums text-texto">{l.saldoApos}</span>
    ),
    papelMobile: 'campo',
  },
  {
    chave: 'observacao',
    cabecalho: 'Observação',
    texto: (l) => l.observacao ?? '—',
    celula: (l) =>
      l.observacao ? (
        <span className="text-texto-suave">{l.observacao}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
    larguraMin: '14rem',
    ordenavel: false,
  },
  {
    chave: 'usuario',
    cabecalho: 'Lançado por',
    texto: (l) => l.usuario ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaExtrato({ linhas }: { linhas: LinhaExtrato[] }) {
  return (
    <TabelaDados
      id="vasilhame-extrato"
      legenda="Extrato de vasilhame do cliente"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(l) => l.id}
      buscaPlaceholder="Buscar por motivo, vasilhame ou observação…"
      nomeExportacao="extrato-vasilhame"
      densidadePadrao="compacta"
      vazio={{
        titulo: 'Nenhum movimento',
        descricao:
          'Este cliente ainda não tem lançamento de vasilhame. Assim que houver entrega ou devolução, cada galão aparece aqui.',
      }}
    />
  )
}
