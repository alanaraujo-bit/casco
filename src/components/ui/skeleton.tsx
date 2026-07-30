import { cn } from '@/lib/utils'

/**
 * Bloco de carregamento. Use com a MESMA altura do conteúdo que vai substituir
 * — skeleton de altura diferente causa salto de layout, que é pior do que a
 * espera que ele tentava disfarçar.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-md bg-esqueleto [animation:casco-pulso_1.8s_ease-in-out_infinite]',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Linhas de tabela em carregamento.
 *
 * `aria-busy` + `aria-live="polite"` no container: quem usa leitor de tela
 * ouve que a região está carregando, em vez de encontrar uma tabela vazia e
 * concluir que não há lançamento nenhum.
 */
export function SkeletonTabela({
  linhas = 5,
  colunas = 4,
}: {
  linhas?: number
  colunas?: number
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-borda">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: colunas }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn('h-4', j === 0 ? 'flex-[2]' : 'flex-1')}
              // Larguras levemente diferentes por linha: skeleton perfeitamente
              // uniforme parece um padrão gráfico, não conteúdo chegando.
              style={{ maxWidth: `${70 + ((i * 7 + j * 13) % 30)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
