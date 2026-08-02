/** Uma pergunta frequente — `<dl>` semântico, não uma lista de `<p>` soltos. */
export function Faq({ pergunta, children }: { pergunta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 border-b border-borda pb-3 last:border-0 last:pb-0">
      <dt className="font-medium text-texto">{pergunta}</dt>
      <dd className="text-sm text-texto-suave">{children}</dd>
    </div>
  )
}

export function ListaFaq({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-3">{children}</dl>
}
