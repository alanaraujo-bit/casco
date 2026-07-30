'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tema = 'light' | 'sistema' | 'dark'

const CHAVE = 'casco-tema'

const OPCOES: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'light', rotulo: 'Claro', Icone: Sun },
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor },
  { valor: 'dark', rotulo: 'Escuro', Icone: Moon },
]

/**
 * Resolve o tema e carimba `data-theme` no <html>. Roda antes da primeira
 * pintura (ver layout.tsx).
 *
 * O atributo é carimbado SEMPRE, inclusive no modo 'sistema'. Isso importa
 * mais do que parece: o variant `dark:` do Tailwind depende de o atributo
 * existir. Se ele só aparecesse na escolha explícita, todo usuário com o
 * aparelho em modo escuro — que é o caso padrão — receberia as variáveis
 * escuras mas nenhuma regra `dark:`, e a elevação dos cartões sumiria.
 */
export const scriptTema = `
(function(){try{
  var t = localStorage.getItem('${CHAVE}');
  var escuroNoSO = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var r = (t === 'light' || t === 'dark') ? t : (escuroNoSO ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', r);
}catch(e){}})();
`

function aplicarNoDocumento(tema: Tema) {
  const escuroNoSO = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvido = tema === 'sistema' ? (escuroNoSO ? 'dark' : 'light') : tema
  document.documentElement.setAttribute('data-theme', resolvido)
}

export function ThemeToggle({ className }: { className?: string }) {
  // Começa em 'sistema' — que é o padrão real — em vez de null. Assim a
  // primeira pintura já mostra a opção correta para a maioria, em vez de
  // mostrar nenhuma selecionada e depois saltar.
  const [tema, setTema] = React.useState<Tema>('sistema')
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useEffect(() => {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === 'light' || salvo === 'dark') setTema(salvo)
  }, [])

  // Em 'sistema', acompanhar a mudança do SO em tempo real: o usuário troca o
  // aparelho para escuro à noite e o app precisa seguir sem recarregar.
  React.useEffect(() => {
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = () => aplicarNoDocumento('sistema')
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [tema])

  function escolher(novo: Tema) {
    setTema(novo)
    localStorage.setItem(CHAVE, novo)
    aplicarNoDocumento(novo)
  }

  /** Roving tabindex: o grupo é um único ponto de tabulação e as setas
   *  navegam dentro dele — que é o contrato que `role="radiogroup"` promete. */
  function aoTeclar(e: React.KeyboardEvent, indice: number) {
    const teclas = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!teclas.includes(e.key)) return
    e.preventDefault()
    const avanca = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const proximo = (indice + (avanca ? 1 : -1) + OPCOES.length) % OPCOES.length
    escolher(OPCOES[proximo].valor)
    refs.current[proximo]?.focus()
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
      {OPCOES.map(({ valor, rotulo, Icone }, i) => {
        const ativo = tema === valor
        return (
          <button
            key={valor}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={rotulo}
            title={rotulo}
            tabIndex={ativo ? 0 : -1}
            onClick={() => escolher(valor)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              // 44px no toque, compacto no desktop.
              'inline-flex size-11 items-center justify-center rounded-md md:size-7',
              'transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
              ativo
                ? // No escuro, `bg-superficie` sobre `afundada` daria 1.04:1 —
                  // seria impossível ver qual tema está ativo justamente no
                  // componente que demonstra os temas.
                  'bg-superficie-elevada text-texto shadow-sm ring-1 ring-borda-forte'
                : 'text-texto-fraco hover:bg-superficie-hover hover:text-texto',
            )}
          >
            <Icone className="size-4 md:size-3.5" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
