'use client'

import Link from 'next/link'
import { Banknote, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { moeda } from '@/lib/utils'
import type { ContaPagarLista, SituacaoConta } from '@/modules/financeiro/consultas'

const TOM_SITUACAO: Record<SituacaoConta, 'sucesso' | 'alerta' | 'perigo'> = {
  Pago: 'sucesso',
  'Em aberto': 'alerta',
  Vencido: 'perigo',
}

/** dd/mm/aaaa ordena por dia se comparado como texto. Vira Date. */
function data(br: string | null) {
  if (!br) return null
  const [d, m, a] = br.split('/')
  return new Date(Number(a), Number(m) - 1, Number(d))
}

/**
 * Colunas na ordem da listagem deles (auditoria §3): Parcela · Descrição ·
 * Despesa/Custos · Categoria · Vencimento · Valor Previsto · Data Pagamento ·
 * Valor Pagamento · Status · Forma Pagamento · Observação.
 *
 * "Despesa/Custos" é a coluna que faz o DRE fechar e que no legado aparece como
 * `NaN`. Aqui ela é escolhida no lançamento, nunca deduzida do texto.
 */
const colunas: Coluna<ContaPagarLista>[] = [
  {
    chave: 'parcela',
    cabecalho: 'Parcela',
    texto: (c) => c.parcela,
    ordenavel: false,
    larguraMin: '5rem',
    papelMobile: 'oculto',
  },
  {
    chave: 'descricao',
    cabecalho: 'Descrição',
    texto: (c) => c.descricao,
    celula: (c) => (
      <span className="flex flex-col">
        <span className="text-texto">{c.descricao}</span>
        {c.fornecedor && <span className="text-xs text-texto-fraco">{c.fornecedor}</span>}
      </span>
    ),
    fixa: true,
    larguraMin: '16rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'natureza',
    cabecalho: 'Despesa/Custos',
    texto: (c) => (c.natureza === 'custo' ? 'Custo' : 'Despesa'),
    celula: (c) => (
      // Cor categórica e não semântica: custo não é "pior" que despesa, é outra
      // coisa. Vermelho aqui sugeriria problema onde só existe classificação.
      <Badge variant={c.natureza === 'custo' ? 'info' : 'neutro'}>
        {c.natureza === 'custo' ? 'Custo' : 'Despesa'}
      </Badge>
    ),
    larguraMin: '8rem',
  },
  {
    chave: 'categoria',
    cabecalho: 'Categoria',
    texto: (c) => c.categoria ?? '—',
    larguraMin: '10rem',
    papelMobile: 'oculto',
  },
  {
    chave: 'vencimento',
    cabecalho: 'Vencimento',
    texto: (c) => c.vencimento,
    valor: (c) => data(c.vencimento),
    papelMobile: 'campo',
  },
  {
    chave: 'valorPrevisto',
    cabecalho: 'Valor Previsto',
    texto: (c) => moeda(Number(c.valorPrevisto)),
    valor: (c) => Number(c.valorPrevisto),
    numerica: true,
    papelMobile: 'destaque',
  },
  {
    chave: 'situacao',
    cabecalho: 'Status',
    texto: (c) => c.situacao,
    celula: (c) => <Badge variant={TOM_SITUACAO[c.situacao]}>{c.situacao}</Badge>,
  },
  {
    chave: 'pagoEm',
    cabecalho: 'Data Pagamento',
    texto: (c) => c.pagoEm ?? '—',
    valor: (c) => data(c.pagoEm),
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'valorPago',
    cabecalho: 'Valor Pagamento',
    texto: (c) => (c.valorPago == null ? '—' : moeda(Number(c.valorPago))),
    valor: (c) => (c.valorPago == null ? null : Number(c.valorPago)),
    numerica: true,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'forma',
    cabecalho: 'Forma Pagamento',
    texto: (c) => c.forma ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'observacao',
    cabecalho: 'Observação',
    texto: (c) => c.observacao ?? '—',
    ordenavel: false,
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'acoes',
    cabecalho: 'Pagamento',
    texto: (c) => (c.situacao === 'Pago' ? 'Pago' : 'Pagar'),
    celula: (c) => (
      <Button asChild variant={c.situacao === 'Pago' ? 'fantasma' : 'suave'} size="sm">
        <Link href={`/financeiro/pagar/${c.id}`}>
          {c.situacao === 'Pago' ? (
            'Ver pagamento'
          ) : (
            <>
              <Banknote aria-hidden />
              Pagar
            </>
          )}
        </Link>
      </Button>
    ),
    ordenavel: false,
    alinhamento: 'direita',
    larguraMin: '9rem',
  },
]

export function TabelaPagar({ linhas }: { linhas: ContaPagarLista[] }) {
  return (
    <TabelaDados
      id="contas-pagar"
      legenda="Contas a pagar"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(c) => c.id}
      buscaPlaceholder="Buscar por descrição, fornecedor, categoria…"
      nomeExportacao="contas-a-pagar"
      densidadePadrao="compacta"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/financeiro/pagar/nova">
            <Plus aria-hidden />
            Lançar conta
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhuma conta lançada',
        descricao:
          'Lance aqui o que a distribuidora deve — compra de garrafão, energia, combustível. Separar custo de despesa é o que faz o resultado do mês fechar.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/financeiro/pagar/nova">
              <Plus aria-hidden />
              Lançar a primeira
            </Link>
          </Button>
        ),
      }}
    />
  )
}
