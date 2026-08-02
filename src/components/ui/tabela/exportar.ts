import type { Coluna } from './tipos'

/**
 * Exporta as linhas visíveis para CSV que o Excel em português abre certo.
 *
 * Três detalhes que parecem irrelevantes e decidem se o arquivo abre ou vira
 * uma coluna só de lixo na máquina da operadora:
 *
 * 1. **BOM UTF-8.** Sem ele o Excel assume a codificação do Windows e "Tucumã"
 *    vira "TucumÃ£". É o motivo número um de reclamação de exportação.
 * 2. **Ponto e vírgula como separador.** No Windows configurado em pt-BR o
 *    separador de lista é `;`; com `,` o Excel joga a linha inteira na coluna A.
 * 3. **`\r\n`.** Excel antigo em Windows ignora quebra de linha só com `\n`.
 *
 * Sobre o nome: o botão diz "Exportar Excel" e entrega CSV. É o vocabulário de
 * quem usa — ninguém no balcão pede "um CSV", pede a planilha.
 */
export function exportarCsv<T>({
  linhas,
  colunas,
  nomeArquivo,
}: {
  linhas: T[]
  colunas: Coluna<T>[]
  /** Sem extensão. A data é acrescentada aqui. */
  nomeArquivo: string
}) {
  const escapar = (v: string) => {
    const s = v.replace(/\r?\n/g, ' ').trim()
    // Aspas duplas dentro do campo dobram; qualquer campo com separador,
    // aspas ou espaço nas pontas vai entre aspas.
    return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const cabecalho = colunas.map((c) => escapar(c.cabecalho)).join(';')
  const corpo = linhas.map((linha) =>
    colunas.map((c) => escapar(c.texto(linha))).join(';'),
  )

  const conteudo = '﻿' + [cabecalho, ...corpo].join('\r\n') + '\r\n'
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })

  const hoje = new Date()
  const carimbo = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0'),
  ].join('-')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeArquivo}-${carimbo}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sem o revoke, cada exportação segura o arquivo inteiro em memória até o
  // usuário fechar a aba, e a tela de conferência é exportada muitas vezes.
  // Mas revogar na mesma volta do laço cancela o download no Firefox: o
  // navegador ainda não leu o blob. Uma volta depois já é seguro.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
