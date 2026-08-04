/**
 * Renderiza o corpo de um patch note: parágrafos, listas com `-` e `**negrito**`.
 *
 * Não é markdown completo, de propósito — o corpo de uma novidade é texto
 * curto, não documentação. Trazer uma biblioteca inteira de markdown para
 * isto pesaria no bundle sem ganho real; o dia em que precisar de tabela ou
 * imagem, essa decisão muda.
 */
function renderizarNegrito(texto: string, chave: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return partes.map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={`${chave}-${i}`} className="font-semibold text-texto">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${chave}-${i}`}>{parte}</span>
    ),
  )
}

export function CorpoMarkdown({ corpo }: { corpo: string }) {
  const blocos = corpo.trim().split(/\n{2,}/)

  return (
    <div className="space-y-3 text-sm text-texto-suave">
      {blocos.map((bloco, i) => {
        const linhas = bloco.split('\n').filter((l) => l.trim())
        const ehLista = linhas.every((l) => l.trim().startsWith('- '))

        if (ehLista) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {linhas.map((l, j) => (
                <li key={j}>{renderizarNegrito(l.trim().slice(2), `${i}-${j}`)}</li>
              ))}
            </ul>
          )
        }

        return <p key={i}>{renderizarNegrito(linhas.join(' '), `${i}`)}</p>
      })}
    </div>
  )
}
