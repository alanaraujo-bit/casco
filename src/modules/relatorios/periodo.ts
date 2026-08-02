import { FUSO } from '@/lib/formatos'

/**
 * O mês como rótulo de calendário, não como instante.
 *
 * "Julho de 2026" não é um ponto no tempo — é o intervalo que começa à
 * meia-noite de 1º de julho **em Tucumã** e termina às 23h59 de 31 de julho, ali
 * também. Tratá-lo como instante é o que faz uma perda lançada às 21h do dia 31
 * cair no mês seguinte, porque no servidor da Vercel já é dia 1º em UTC.
 *
 * Por isso o mês viaja como `YYYY-MM` em toda a Etapa 6: na URL, na consulta e
 * na tela. Uma string sem fuso não tem como ser convertida errado, e as views
 * da 0012 já entregam o mês fechado no fuso da loja para casar com ela.
 */

/** `2026-08`. É o formato da URL e o que as consultas comparam. */
export type Mes = string

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** O mês corrente **na loja**. O par de `dataNaLoja`, um degrau acima. */
export function mesNaLoja(deslocamentoMeses = 0): Mes {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: FUSO })
  const [ano, mes] = hoje.split('-').map(Number)
  // Aritmética em UTC de propósito, como em `dataNaLoja`: a data já vem
  // resolvida no fuso da loja antes de qualquer soma.
  const base = new Date(Date.UTC(ano, mes - 1 + deslocamentoMeses, 1))
  return base.toISOString().slice(0, 7)
}

/**
 * Aceita o que veio da URL, ou devolve o mês corrente.
 *
 * O usuário edita a barra de endereços, e um mês inválido não pode virar
 * `Invalid Date` chegando ao Postgres — vira o mês de hoje, que é a resposta
 * que a tela daria sem parâmetro nenhum.
 */
export function mesValido(valor: string | undefined): Mes {
  if (!valor || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return mesNaLoja()
  return valor
}

/** `2026-08` → `agosto de 2026`. */
export function mesPorExtenso(mes: Mes): string {
  const [ano, m] = mes.split('-')
  return `${MESES[Number(m) - 1]} de ${ano}`
}

/** `2026-08` → `ago/26`. Para o eixo do gráfico e a coluna da tabela. */
export function mesCurto(mes: Mes): string {
  const [ano, m] = mes.split('-')
  return `${MESES[Number(m) - 1].slice(0, 3)}/${ano.slice(2)}`
}

/** O mês vizinho, para os botões de navegar. */
export function mesVizinho(mes: Mes, passo: number): Mes {
  const [ano, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(ano, m - 1 + passo, 1)).toISOString().slice(0, 7)
}

/** Os últimos `n` meses terminando em `ate`, do mais antigo ao mais recente. */
export function ultimosMeses(n: number, ate: Mes = mesNaLoja()): Mes[] {
  return Array.from({ length: n }, (_, i) => mesVizinho(ate, i - (n - 1)))
}
