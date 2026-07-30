'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tema = 'light' | 'sistema' | 'dark'

const CHAVE = 'casco-tema'

/** Precisa acompanhar `--fundo` de cada tema em globals.css. */
const COR_BARRA = { light: '#f3f4f6', dark: '#050608' } as const

const OPCOES = [
  { valor: 'light', rotulo: 'Claro', Icone: Sun, ativo: 'pref-light:' },
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor, ativo: 'pref-sistema:' },
  { valor: 'dark', rotulo: 'Escuro', Icone: Moon, ativo: 'pref-dark:' },
] as const

/**
 * Resolve o tema e carimba o <html> antes da primeira pintura (ver layout.tsx).
 *
 * Carimba três coisas:
 * - `data-theme`: o tema RESOLVIDO. É o que as variáveis e o variant `dark:`
 *   leem. Precisa existir SEMPRE, inclusive no modo 'sistema' — se só
 *   aparecesse na escolha explícita, todo usuário com o aparelho em escuro
 *   receberia as variáveis escuras mas nenhuma regra `dark:`.
 * - `data-tema-pref`: a PREFERÊNCIA, que é outra coisa. É o que pinta a opção
 *   ativa do seletor por CSS, sem depender de estado do React.
 * - `<meta name="theme-color">`: a cor da barra do navegador. Precisa seguir o
 *   tema resolvido, não `prefers-color-scheme` — quem força um tema contra o
 *   SO teria a barra de uma cor e a página de outra.
 */
export const scriptTema = `
(function(){try{
  var p = localStorage.getItem('${CHAVE}');
  if (p !== 'light' && p !== 'dark') p = 'sistema';
  var escuroNoSO = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var r = p === 'sistema' ? (escuroNoSO ? 'dark' : 'light') : p;
  var raiz = document.documentElement;
  raiz.setAttribute('data-theme', r);
  raiz.setAttribute('data-tema-pref', p);
  var m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.setAttribute('content', r === 'dark' ? '${COR_BARRA.dark}' : '${COR_BARRA.light}');
}catch(e){}})();
`

function aplicarNoDocumento(pref: Tema) {
  const escuroNoSO = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvido = pref === 'sistema' ? (escuroNoSO ? 'dark' : 'light') : pref

  const raiz = document.documentElement
  raiz.setAttribute('data-theme', resolvido)
  raiz.setAttribute('data-tema-pref', pref)

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', COR_BARRA[resolvido])
}

export function ThemeToggle({ className }: { className?: string }) {
  // Só existe para `aria-checked` e para o roving tabindex. O visual do ativo
  // vem do CSS, a partir de `data-tema-pref` — que o script já carimbou antes
  // da primeira pintura. Sem isso, quem escolheu um tema explícito veria o
  // indicador saltar depois da hidratação.
  const [pref, setPref] = React.useState<Tema>('sistema')
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useEffect(() => {
    const atual = document.documentElement.getAttribute('data-tema-pref')
    if (atual === 'light' || atual === 'dark' || atual === 'sistema') setPref(atual)
  }, [])

  // Em 'sistema', seguir o SO em tempo real: o usuário troca o aparelho para
  // escuro à noite e o app acompanha sem recarregar.
  React.useEffect(() => {
    if (pref !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = () => aplicarNoDocumento('sistema')
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [pref])

  function escolher(novo: Tema) {
    setPref(novo)
    localStorage.setItem(CHAVE, novo)
    aplicarNoDocumento(novo)
  }

  /** Roving tabindex: o grupo é um único ponto de tabulação e as setas
   *  navegam dentro dele — que é o contrato que `role="radiogroup"` promete. */
  function aoTeclar(e: React.KeyboardEvent, indice: number) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return
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
      {OPCOES.map(({ valor, rotulo, Icone }, i) => (
        <button
          key={valor}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={pref === valor}
          aria-label={rotulo}
          title={rotulo}
          tabIndex={pref === valor ? 0 : -1}
          onClick={() => escolher(valor)}
          onKeyDown={(e) => aoTeclar(e, i)}
          className={cn(
            // 44px no toque, compacto no desktop.
            'inline-flex size-11 items-center justify-center rounded-md md:size-7',
            'transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
            'text-texto-fraco hover:bg-superficie-hover hover:text-texto',
            // Estado ativo por CSS. `superficie` sobre o trilho `afundada` dava
            // 1.04:1 no escuro — era impossível ver o tema selecionado
            // justamente no componente que demonstra os temas.
            valor === 'light' &&
              'pref-light:bg-superficie-elevada pref-light:text-texto pref-light:shadow-sm pref-light:ring-1 pref-light:ring-borda-forte',
            valor === 'sistema' &&
              'pref-sistema:bg-superficie-elevada pref-sistema:text-texto pref-sistema:shadow-sm pref-sistema:ring-1 pref-sistema:ring-borda-forte',
            valor === 'dark' &&
              'pref-dark:bg-superficie-elevada pref-dark:text-texto pref-dark:shadow-sm pref-dark:ring-1 pref-dark:ring-borda-forte',
          )}
        >
          <Icone className="size-4 md:size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  )
}
