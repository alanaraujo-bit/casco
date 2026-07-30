'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tema = 'light' | 'dark' | 'sistema'

const OPCOES: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'light', rotulo: 'Claro', Icone: Sun },
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor },
  { valor: 'dark', rotulo: 'Escuro', Icone: Moon },
]

export function ThemeToggle({ className }: { className?: string }) {
  // Começa em null e só resolve depois de montar: o valor real vive no
  // localStorage, que o servidor não conhece. Renderizar um palpite aqui
  // causaria hydration mismatch.
  const [tema, setTema] = React.useState<Tema | null>(null)

  React.useEffect(() => {
    const salvo = localStorage.getItem('casco-tema') as Tema | null
    setTema(salvo ?? 'sistema')
  }, [])

  function aplicar(novo: Tema) {
    setTema(novo)
    localStorage.setItem('casco-tema', novo)

    const raiz = document.documentElement
    if (novo === 'sistema') {
      raiz.removeAttribute('data-theme')
    } else {
      raiz.setAttribute('data-theme', novo)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-borda bg-superficie-afundada p-0.5',
        className,
      )}
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        const ativo = tema === valor
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={rotulo}
            title={rotulo}
            onClick={() => aplicar(valor)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
              ativo
                ? 'bg-superficie text-texto shadow-sm'
                : 'text-texto-fraco hover:text-texto hover:bg-superficie-hover',
            )}
          >
            <Icone className="size-3.5" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Roda antes da primeira pintura, no <head>. Sem isso a página nasce clara e
 * pisca para escura na hidratação — o "flash of wrong theme", que é a coisa
 * mais barata de evitar e a que mais denuncia app malfeito.
 */
export const scriptTema = `
(function(){try{
  var t = localStorage.getItem('casco-tema');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();
`
