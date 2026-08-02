/**
 * Documento, telefone e CEP: como guardar e como mostrar.
 *
 * **Regra: no banco vai só dígito; a máscara é coisa de tela.** O mesmo CPF
 * digitado como `123.456.789-09` e como `12345678909` são a mesma pessoa, e o
 * índice único de `clientes(company_id, documento)` só percebe isso se as duas
 * formas virarem a mesma string. Guardar o texto como veio é o caminho curto
 * para criar o mesmo cliente duas vezes e mandar duas cobranças.
 */

/** Tira tudo que não é dígito. É o que vai para o banco. */
export function soDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '')
}

/** `12345678909` → `123.456.789-09` · `12345678000190` → `12.345.678/0001-90` */
export function formatarDocumento(valor: string | null | undefined): string {
  const d = soDigitos(valor)
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }
  // Comprimento inesperado sai como veio: melhor mostrar o dado torto do que
  // uma máscara que mente sobre o que está gravado.
  return d
}

/** `94981001234` → `(94) 98100-1234` */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = soDigitos(valor)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

/** `68385000` → `68385-000` */
export function formatarCep(valor: string | null | undefined): string {
  const d = soDigitos(valor)
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/* ------------------------------------------------------------- máscaras
 *
 * As de cima formatam valor pronto; estas formatam o que está sendo digitado.
 * A diferença importa: `formatarDocumento` devolve os dígitos crus quando o
 * comprimento não fecha, porque mostrar máscara falsa sobre dado gravado seria
 * mentir. Digitando, o comprimento está incompleto o tempo todo — e a máscara
 * precisa aparecer mesmo assim, senão os separadores só surgem no último
 * caractere e o campo dá um pulo.
 */

/** Máscara progressiva de CPF/CNPJ. Vira CNPJ ao passar de 11 dígitos. */
export function mascararDocumento(valor: string): string {
  const d = soDigitos(valor).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

/** Máscara progressiva de telefone. Suporta fixo e celular. */
export function mascararTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{1,2})/, '($1')
  const corpo = d.length <= 10 ? 4 : 5
  return d
    .replace(new RegExp(`^(\\d{2})(\\d{1,${corpo}})`), '($1) $2')
    .replace(new RegExp(`^\\((\\d{2})\\) (\\d{${corpo}})(\\d)`), '($1) $2-$3')
}

/** Máscara progressiva de CEP. */
export function mascararCep(valor: string): string {
  return soDigitos(valor).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

/**
 * Valida CPF pelos dois dígitos verificadores.
 *
 * Não é preciosismo: documento errado no cadastro é cobrança que não sai e nota
 * que é rejeitada. O erro aparece meses depois, longe da causa, e aí ninguém
 * lembra qual dígito foi trocado. Custa duas linhas checar na hora da digitação.
 */
export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 11) return false
  // Todos iguais passam na conta dos verificadores (111.111.111-11 fecha).
  if (/^(\d)\1{10}$/.test(d)) return false

  for (const [ate, posicao] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (posicao - i)
    const resto = (soma * 10) % 11
    if ((resto === 10 ? 0 : resto) !== Number(d[ate])) return false
  }
  return true
}

/** Valida CNPJ pelos dois dígitos verificadores. */
export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  for (const ate of [12, 13]) {
    let peso = ate - 7
    let soma = 0
    for (let i = 0; i < ate; i++) {
      soma += Number(d[i]) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    if ((resto < 2 ? 0 : 11 - resto) !== Number(d[ate])) return false
  }
  return true
}

/** Aceita CPF ou CNPJ. Vazio é válido: cadastro incompleto é realidade. */
export function documentoValido(valor: string | null | undefined): boolean {
  const d = soDigitos(valor)
  if (d.length === 0) return true
  if (d.length === 11) return cpfValido(d)
  if (d.length === 14) return cnpjValido(d)
  return false
}

/** Telefone brasileiro: fixo (10) ou celular (11). Vazio é válido. */
export function telefoneValido(valor: string | null | undefined): boolean {
  const d = soDigitos(valor)
  return d.length === 0 || d.length === 10 || d.length === 11
}

/* --------------------------------------------------------------- data e hora
 *
 * **Toda data com hora passa por aqui, e o fuso é explícito.**
 *
 * `toLocaleString('pt-BR')` sem `timeZone` usa o fuso de quem está formatando.
 * No servidor da Vercel isso é UTC; no navegador da operadora, UTC−3. O mesmo
 * lançamento então rende "16:08" de um lado e "13:08" do outro, e o React
 * derruba a hidratação da tela inteira ao encontrar a diferença (erro #418).
 *
 * O sintoma é o erro; o estrago é a hora errada. Um movimento de vasilhame
 * lançado às 17h aparecendo como 20h destrói justamente a utilidade do extrato,
 * que é reconstruir o que aconteceu no balcão e quando.
 *
 * Não pegamos isso no `next dev` porque ali servidor e navegador são a mesma
 * máquina, no mesmo fuso. Só apareceu rodando o fluxo contra produção.
 */

/**
 * Tucumã/PA. Sem horário de verão desde 2019, então é UTC−3 o ano inteiro.
 *
 * Constante e não configuração porque hoje toda distribuidora atendida está no
 * Pará. No dia em que uma não estiver, isto vira coluna em `companies` — e o
 * lugar de mudar é este, não as quinze telas que mostram data.
 */
export const FUSO = 'America/Belem'

/** `01/08/26, 16:08` — o formato das listagens de movimento. */
export function formatarDataHora(valor: Date | string): string {
  return new Date(valor).toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** `01/08/2026` — quando a hora não acrescenta nada. */
export function formatarData(valor: Date | string): string {
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: FUSO })
}

/**
 * A data de hoje **na loja**, como `YYYY-MM-DD`, opcionalmente deslocada em dias.
 *
 * É o par de escrita das funções de cima: elas resolvem o fuso na hora de
 * mostrar, esta resolve na hora de gravar. Toda coluna `date` do banco —
 * emissão e vencimento de título, data de movimento de caixa — passa por aqui.
 *
 * `new Date().toISOString().slice(0, 10)` no servidor da Vercel devolve a data
 * em UTC: uma venda fechada às 21h de Tucumã nasceria com a data do dia
 * seguinte, e o fechamento de caixa da operadora não bateria com a tela. Ela
 * teria razão, e o erro só apareceria no fim do mês.
 *
 * A aritmética é feita em UTC de propósito: somar dias sobre um `Date` no fuso
 * local erra na virada do horário de verão. A data já vem resolvida no fuso da
 * loja antes de qualquer soma.
 */
export function dataNaLoja(deslocamentoDias = 0): string {
  // `en-CA` é o locale que formata como `2026-08-01` — o mesmo formato que o
  // Postgres aceita em coluna `date`, sem passo de conversão no meio.
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: FUSO })
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const base = new Date(Date.UTC(ano, mes - 1, dia))
  base.setUTCDate(base.getUTCDate() + deslocamentoDias)
  return base.toISOString().slice(0, 10)
}

/**
 * `2026-08-01` → `01/08/2026`. Para coluna `date`, que **não tem hora**.
 *
 * Não é redundante com `formatarData`: aquela recebe um instante e precisa
 * decidir em que dia ele caiu, aqui em Tucumã. Esta recebe um dia que já é um
 * dia — vencimento, emissão — e a única coisa que pode fazer de errado é
 * convertê-lo. `new Date('2026-08-01')` vira meia-noite **UTC**, que em
 * UTC−3 ainda é 31 de julho: o título venceria um dia antes na tela.
 */
export function formatarDataISO(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** `16:08` — para o que aconteceu hoje, onde a data é redundante. */
export function formatarHora(valor: Date | string): string {
  return new Date(valor).toLocaleTimeString('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const
