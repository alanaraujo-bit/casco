<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Casco

Sistema de gestão para **distribuidoras com vasilhame retornável** — água e gás.
Produto da Aionix. Multi-tenant: uma instalação serve várias distribuidoras.

Primeiro cliente: LM Distribuidora Natuclara (Tucumã/PA), migrando do Fature Gestão.
Auditoria do sistema que estamos substituindo: `docs/00-auditoria-sistema-legado.md`.

## Breaking changes desta versão do Next que já nos afetam

Next.js **16.2.12**. Confirmado em `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`:

- **`middleware.ts` não existe mais** — é `proxy.ts`, com export nomeado `proxy`.
  Runtime é `nodejs` e não é configurável (sem edge).
- **APIs de request são assíncronas e ponto** — `cookies()`, `headers()`, `draftMode()`,
  e `params`/`searchParams` em page/layout/route. Acesso síncrono foi removido.
- **Turbopack é o padrão** em `next dev` e `next build`.
- **`next lint` foi removido.** Use `npm run lint` (ESLint CLI direto).
- **`revalidateTag` exige segundo argumento** (perfil de `cacheLife`).
  Para read-your-writes em Server Action, use `updateTag`.
- Tipos de rota: rode `npx next typegen` e use `PageProps<'/rota'>` / `LayoutProps<'/rota'>`.
- `next dev` escreve em `.next/dev`, separado do build.

## Regras do projeto

**Multi-tenancy é responsabilidade do banco, não da aplicação.**
Toda tabela de negócio tem `company_id` e RLS ligada. Nenhuma query de negócio roda
fora do wrapper `withTenant()` — ele abre transação e faz
`set_config('app.company_id', ..., true)`. O `true` é obrigatório: torna o valor local
à transação, senão o PgBouncer recicla a conexão e vaza dado entre distribuidoras.

**Baixa de vasilhame nunca é venda.** Galão quebrado, trincado ou perdido é evento de
estoque com `motivo`, e vira custo — jamais receita. É o bug conceitual do sistema
antigo, e a razão pela qual o cliente está trocando. Não repetir.

**Familiaridade acima de originalidade.** O usuário vem de outro sistema. Mantemos o
vocabulário ("Contas a Receber", "Baixa Estoque"), os grupos de menu e a ordem das
colunas do sistema antigo. Mudamos densidade, cor, velocidade e estados.
Regra: se um fluxo novo não for obviamente melhor em 5 segundos de uso, mantenha o antigo.

**Uma etapa por vez, terminada.** Ver `docs/03-roadmap.md`. Cada etapa passa por três
níveis (Funciona → Fluido → Premium) antes da próxima começar.

**Pronto significa rodando.** Build passar não é prova. Execute o fluxo de verdade,
no desktop e no celular, antes de dizer que terminou.

## Estrutura

```
src/
  app/         rotas (App Router)
  components/  ui/ (primitivos) e layout/ (shell, sidebar, topbar)
  db/          schema Drizzle, cliente, withTenant
  lib/         utilidades, auth
  modules/     lógica por domínio (clientes, vasilhame, vendas, ...)
docs/          auditoria, arquitetura, modelo de dados, roadmap
```

## Infra

Vercel (app) · Railway (Postgres + PgBouncer) · GitHub (deploy automático na `main`).
Nunca commitar `.env*`. Dados reais do cliente não entram no repositório.
