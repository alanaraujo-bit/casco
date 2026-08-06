'use client'

import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDataHora } from '@/lib/formatos'
import { moeda } from '@/lib/utils'
import type { AberturaCaixaLista } from '@/modules/financeiro/consultas'

const colunas: Coluna<AberturaCaixaLista>[] = [
  {
    chave: 'abertaEm',
    cabecalho: 'Abertura',
    texto: (a) => formatarDataHora(a.abertaEm),
    valor: (a) => new Date(a.abertaEm),
    fixa: true,
    larguraMin: '9rem',
    papelMobile: 'titulo',
  },
  { chave: 'conta', cabecalho: 'Caixa', texto: (a) => a.conta, larguraMin: '8rem' },
  {
    chave: 'valorAbertura',
    cabecalho: 'Dinheiro na gaveta',
    texto: (a) => moeda(Number(a.valorAbertura)),
    valor: (a) => Number(a.valorAbertura),
    numerica: true,
    papelMobile: 'destaque',
  },
  {
    chave: 'fundoTroco',
    cabecalho: 'Fundo de troco',
    texto: (a) => moeda(Number(a.fundoTroco)),
    valor: (a) => Number(a.fundoTroco),
    numerica: true,
  },
  {
    chave: 'usuario',
    cabecalho: 'Registrado por',
    texto: (a) => a.usuario ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
  {
    chave: 'observacao',
    cabecalho: 'Observação',
    texto: (a) => a.observacao ?? '—',
    ocultaPorPadrao: true,
    papelMobile: 'oculto',
  },
]

export function TabelaAberturas({ linhas }: { linhas: AberturaCaixaLista[] }) {
  return (
    <TabelaDados
      id="financeiro-caixa-aberturas"
      legenda="Aberturas de caixa registradas"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(a) => a.id}
      buscaPlaceholder="Buscar por caixa ou observação…"
      nomeExportacao="aberturas-de-caixa"
      densidadePadrao="compacta"
      vazio={{
        titulo: 'Nenhuma abertura registrada',
        descricao: 'Registre acima quanto tem na gaveta ao abrir o turno.',
      }}
    />
  )
}
