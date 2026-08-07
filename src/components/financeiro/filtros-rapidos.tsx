'use client'

import { cn } from '@/lib/utils'
import { dataNaLoja } from '@/lib/formatos'

export type AtalhoFiltro = 'vencido' | 'a_vencer' | 'pago' | 'vence_hoje' | 'vence_7dias'

interface LinhaComVencimento {
  situacao: string
  vencimento: string
}

/** `dd/mm/aaaa` → `Date`, à meia-noite local. */
function paraData(br: string): Date | null {
  const [d, m, a] = br.split('/')
  if (!d || !m || !a) return null
  return new Date(Number(a), Number(m) - 1, Number(d))
}

/**
 * `YYYY-MM-DD` → `Date`, à meia-noite local.
 *
 * "Hoje" não pode vir de `new Date()` puro: isso pega o fuso do dispositivo
 * de quem está com a tela aberta, não o da loja. Um celular configurado em
 * outro fuso (ou com fuso automático desligado) classificaria "Vence Hoje"
 * de forma diferente do que o resto do sistema considera hoje. `dataNaLoja`
 * já resolve isso via `America/Belem`; aqui só convertemos a data de volta
 * em componentes ano/mês/dia locais para comparar com `paraData`.
 */
function inicioDoDia(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/**
 * Aplica o atalho sobre as linhas já carregadas na tela.
 *
 * Client-side de propósito, e não mais uma ida ao servidor: as linhas do mês
 * (ou de todo o período) já estão na tela para a busca e a ordenação da
 * própria tabela, e o atalho é só mais um recorte do que já chegou — o mesmo
 * raciocínio que já vale para a busca por texto.
 */
export function filtrarPorAtalho<T extends LinhaComVencimento>(
  linhas: T[],
  atalho: AtalhoFiltro | null,
  rotuloPago: 'Pago' | 'Recebido',
): T[] {
  if (!atalho) return linhas

  const hoje = inicioDoDia(dataNaLoja())
  const em7Dias = inicioDoDia(dataNaLoja(7))

  return linhas.filter((l) => {
    if (atalho === 'pago') return l.situacao === rotuloPago
    if (atalho === 'vencido') return l.situacao === 'Vencido'
    if (atalho === 'a_vencer') return l.situacao === 'Em aberto'

    // "Vence hoje" e "vence em 7 dias" só fazem sentido para quem ainda não
    // pagou — um título recebido ontem não "vence" mais nada.
    if (l.situacao === rotuloPago) return false
    const venc = paraData(l.vencimento)
    if (!venc) return false
    if (atalho === 'vence_hoje') return venc.getTime() === hoje.getTime()
    return venc >= hoje && venc <= em7Dias
  })
}

const ROTULO: Record<AtalhoFiltro, string> = {
  vencido: 'Vencido',
  a_vencer: 'A Vencer',
  pago: '', // substituído por `rotuloPago`
  vence_hoje: 'Vence Hoje',
  vence_7dias: 'Vence em 7 dias',
}

/**
 * A fileira de atalhos acima da tabela.
 *
 * Existem porque os cartões do topo respondem "quanto", e o balcão às vezes
 * quer "quais" — clicar em "Vencido" e ver a lista, sem digitar nada na
 * busca. `Limpar Filtros` só aparece com um atalho ativo: um botão que nunca
 * muda de estado é ruído.
 */
export function FiltrosRapidos({
  atalho,
  aoEscolher,
  rotuloPago,
}: {
  atalho: AtalhoFiltro | null
  aoEscolher: (novo: AtalhoFiltro | null) => void
  rotuloPago: 'Pago' | 'Recebido'
}) {
  const atalhos: AtalhoFiltro[] = ['vencido', 'a_vencer', 'pago', 'vence_hoje', 'vence_7dias']

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros rápidos">
      {atalhos.map((a) => (
        <button
          key={a}
          type="button"
          aria-pressed={atalho === a}
          onClick={() => aoEscolher(atalho === a ? null : a)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
            atalho === a
              ? 'border-acento-suave-borda bg-acento-suave text-acento-texto'
              : 'border-borda-controle bg-superficie text-texto-suave hover:bg-superficie-hover',
          )}
        >
          {a === 'pago' ? rotuloPago : ROTULO[a]}
        </button>
      ))}

      {atalho && (
        <button
          type="button"
          onClick={() => aoEscolher(null)}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-texto-suave underline-offset-2 hover:text-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Limpar Filtros
        </button>
      )}
    </div>
  )
}
