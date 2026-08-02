import { Check } from 'lucide-react'
import { GlifoCasco, CASCO_GLIFO_D } from './glifo-casco'
import { CascoCarregando } from './casco-carregando'

const RECURSOS = [
  'Vasilhame rastreado por cliente',
  'Contas a receber sem letra miúda',
  'PDV que fecha o caixa em segundos',
]

/**
 * Painel de marca da tela de login. Fica escuro sempre, independente do tema
 * do resto do app — é vitrine, não interface, então não precisa (nem deve)
 * seguir claro/escuro: um painel fixo garante que fique bem em qualquer
 * combinação de tema sem duplicar o trabalho de estilizar dois.
 *
 * As cores petróleo aqui são `style` inline, não utility do Tailwind: são as
 * variáveis cruas (`--petroleo-400`..`--petroleo-950`) que `globals.css`
 * expõe, e que o `@theme inline` não republica como classe porque o resto do
 * app só consome a paleta através dos tokens semânticos (`--acento` etc.).
 * Este painel é a única exceção de propósito — é vitrine fixa, não segue tema.
 *
 * No mobile vira uma faixa compacta: só o emblema e o nome. Todo o resto
 * (headline, lista, marca d'água) some com `hidden lg:*` — a operadora abre
 * isso às 7h da manhã, e o campo de e-mail precisa estar a um scroll de
 * distância zero, não embaixo de uma vitrine.
 */
export function PainelMarca() {
  return (
    <div
      className="relative isolate flex shrink-0 flex-col justify-between overflow-hidden px-6 py-5 text-white lg:w-[42%] lg:px-10 lg:py-11"
      style={{
        backgroundImage:
          'linear-gradient(160deg, var(--petroleo-800) 0%, var(--petroleo-950) 55%, var(--cinza-1000) 100%)',
      }}
    >
      {/* Textura e brilhos — só no desktop, onde há espaço pra respirar sem
          disputar atenção com o formulário. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          backgroundImage: 'radial-gradient(oklch(1 0 0 / 0.1) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 30% 20%, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 30% 20%, black 40%, transparent 85%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-28 hidden size-[480px] rounded-full opacity-35 blur-[10px] lg:block"
        style={{ backgroundImage: 'radial-gradient(circle, var(--petroleo-500) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-36 -bottom-40 hidden size-[420px] rounded-full opacity-20 blur-[10px] lg:block"
        style={{ backgroundImage: 'radial-gradient(circle, var(--petroleo-400) 0%, transparent 70%)' }}
      />
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-14 -bottom-10 hidden size-[380px] rotate-[-8deg] opacity-[0.07] lg:block"
      >
        <path fillRule="evenodd" fill="white" d={CASCO_GLIFO_D} />
      </svg>

      {/* Emblema — sempre visível, é a única coisa que precisa aparecer no mobile. */}
      <div className="relative z-10 flex items-center gap-2.5">
        <div
          className="grid size-8 shrink-0 place-items-center rounded-[9px] shadow-[0_6px_16px_oklch(0_0_0/0.35)] lg:size-10 lg:rounded-xl"
          style={{ backgroundImage: 'linear-gradient(155deg, var(--petroleo-400), var(--petroleo-700) 85%)' }}
        >
          <CascoCarregando duracaoMs={5500} className="size-[56%] lg:hidden" />
          <GlifoCasco className="hidden size-[56%] lg:block" />
        </div>
        <span className="text-lg font-semibold tracking-tight lg:text-[19px]">Casco</span>
      </div>

      {/* Discurso — só no desktop. */}
      <div className="relative z-10 hidden max-w-[380px] lg:block">
        <h1 className="mb-3.5 text-[30px] leading-[1.18] font-semibold tracking-tight text-balance">
          O vasilhame vai.
          <br />O vasilhame <span style={{ color: 'var(--petroleo-300)' }}>volta</span>.
          <br />
          Você não perde o fio.
        </h1>
        <p className="max-w-[340px] text-[14.5px] leading-relaxed" style={{ color: 'oklch(0.885 0.058 200 / 0.85)' }}>
          Gestão para distribuidoras de água e gás com vasilhame retornável — do
          pedido ao caixa, sem planilha por trás.
        </p>

        <ul className="mt-7 flex flex-col gap-2.5">
          {RECURSOS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2.5 text-[13.5px]"
              style={{ color: 'oklch(0.976 0.014 200 / 0.9)' }}
            >
              <span className="grid size-[15px] shrink-0 place-items-center rounded-[5px] bg-white/10">
                <Check className="size-[9px]" style={{ color: 'var(--petroleo-300)' }} strokeWidth={3} aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Crédito — só no desktop; no mobile some junto com o resto da vitrine.
          O arquivo é o oficial do manual da marca (`aionix-horizontal-cor-negativo.svg`,
          feito pra fundo escuro) — o manual proíbe expressamente redesenhar o
          logotipo digitando "AIONIX" numa fonte qualquer, então a imagem vem
          de `public/marca/`, não de um SVG desenhado à mão aqui. */}
      <a
        href="https://www.aionixdev.com"
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-10 hidden items-center gap-1.5 text-[11.5px] text-white/60 transition-colors hover:text-white/85 lg:inline-flex"
      >
        Um produto
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático do manual da marca, não precisa de otimização do next/image */}
        <img src="/marca/aionix-horizontal-cor-negativo.svg" alt="Aionix" className="h-[13px] w-auto opacity-90" />
      </a>
    </div>
  )
}
