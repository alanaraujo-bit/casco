# Casco

Sistema de gestão para distribuidoras com **vasilhame retornável** — água e gás.
Produto da [Aionix](https://www.aionixdev.com).

O que separa o Casco de um ERP genérico: o vasilhame é tratado como o que ele é —
um ativo emprestado que circula, quebra e às vezes some. Não como uma linha de venda.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router) · React 19 · TypeScript |
| Estilo | Tailwind v4 · shadcn/ui |
| Banco | Postgres (Railway) · Drizzle · RLS por `company_id` |
| Auth | Auth.js v5 |
| Deploy | Vercel — push na `main` publica |

## Rodando local

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

## Scripts

| comando | o que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (Turbopack) |
| `npm run build` | build de produção |
| `npm run start` | serve o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir |

## Documentação

| arquivo | conteúdo |
|---|---|
| [docs/00-auditoria-sistema-legado.md](docs/00-auditoria-sistema-legado.md) | o sistema que estamos substituindo, tela a tela |
| [docs/01-stack-e-arquitetura.md](docs/01-stack-e-arquitetura.md) | decisões de stack, multi-tenancy, PWA |
| [docs/02-modelo-de-dados.md](docs/02-modelo-de-dados.md) | schema do núcleo |
| [docs/03-roadmap.md](docs/03-roadmap.md) | etapas, níveis e ordem de construção |
| [AGENTS.md](AGENTS.md) | regras para quem (ou o que) escreve código aqui |

## Aviso

Repositório privado. A documentação contém dados operacionais reais de cliente.
Nada de `.env`, nada de dado de cliente versionado.
