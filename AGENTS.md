<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Casco

Sistema de gestão para **distribuidoras com vasilhame retornável** — água e gás.
Produto da Aionix. Multi-tenant: uma instalação serve várias distribuidoras.

Primeiro cliente: JM Distribuidora Natuclara (Tucumã/PA), migrando do Fature Gestão.
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

**Toda tela nova é uma pergunta para a Central de Ajuda.** Ao terminar uma tela ou
mudar um fluxo (Nível 1 em diante), pergunte: isso muda o que a operadora vê ou faz?
Se sim, a etapa só conta como pronta depois que `src/lib/ajuda.ts` ganhar um artigo novo
— ou um existente for ajustado. Não espere o Alan pedir; é para isso que esta frase está
aqui. O padrão de artigo (texto claro, `Passos`, `Dica`/`Atencao`/`Importante`, FAQ) mora
em `src/components/ajuda/`, com exemplo completo no grupo Vasilhame. Vídeo real do fluxo,
via `node scripts/capturar-ajuda.mjs`, quando o caminho não for óbvio só de ler — a Central
existe para o cliente resolver dúvida sozinho, sem ligar para ninguém.

**Todo commit relevante é uma pergunta para o Patch Notes.** Antes de subir uma
mudança que muda o que o cliente vê ou faz, pergunte: isso merece uma entrada na
Central de Atualizações (`/atualizacoes`)? Refatoração, ajuste de config, comentário
— não. Funcionalidade nova, correção perceptível, mudança de fluxo — sim. Se sim,
escreva e publique com `npm run patch-note -- --titulo "..." --resumo "..." --categoria
<novo|melhoria|correcao|desempenho|seguranca|interface> --corpo "..." --admin-email
<seu-email> --publicar` antes ou junto do push. Não espere o Alan pedir, pelo mesmo
motivo da Central de Ajuda: é a equipe do produto escrevendo para quem usa, não um
`git log`. A mesma regra de "não invente" vale aqui — o texto descreve só o que a
mudança sustenta, sem benefício ou número que não exista. Sem `--publicar`, a nota
nasce como rascunho em `/admin/patch-notes` para revisar antes de ir ao ar.

**Nada no repositório compara o Casco com outro sistema.** Nem em tela, nem em
artigo de ajuda, nem em mensagem de erro — e **nem em comentário de código.**
Nada de "no sistema antigo", "no sistema deles", "diferente do que você usava",
citação de fornecedor pelo nome, nem a venda de R$ 0,13.

Na interface, porque o Casco é vendido para várias distribuidoras e a maioria
nunca usou o sistema que a JM está deixando: para elas a comparação não
significa nada e ainda soa como desculpa — como se o produto se vendesse por ser
melhor que um concorrente, e não por ser bom. No código, porque o repositório é
lido por gente de fora (auditoria, novo dev, o próprio cliente) e o mesmo tom
pega igualmente mal ali.

O jeito certo de escrever a mesma razão é impessoal: **descreva o defeito, não
quem o cometeu.** "Guardar a situação como coluna produz linha 'Vencido' com
vencimento no mês que vem" diz tudo que "no sistema deles dá para ver…" dizia, e
continua verdade em qualquer sistema. O raciocínio comparativo concreto — com
nome, versão e print — vive em `docs/`, que não é entregue ao cliente.

Três comandos tornam isso verificável, e cada um pega o que os outros não pegam:

| | |
|---|---|
| `npm run db:provar` | As regras que moram no banco — RLS, constraint, trigger — exercitadas como `casco_app`, o papel restrito da aplicação. |
| `npm run fluxo` | O fluxo real num Chrome de verdade: login digitado, botões clicados, celular emulado. Pega o que `tsc` não vê. |
| `npm run build` | Por último, e só confirma que compila. |

**O `next dev` esconde uma classe inteira de bug: a de fuso horário.** Ali
servidor e navegador são a mesma máquina, no mesmo fuso. Na Vercel o servidor
roda em UTC e o navegador da operadora em UTC−3, então `toLocaleString('pt-BR')`
sem `timeZone` rende textos diferentes nos dois lados — o React derruba a
hidratação da tela (erro #418) e a hora exibida fica três horas adiantada.
Toda data com hora passa por `formatarDataHora` / `formatarData` /
`formatarHora` em `src/lib/formatos.ts`, que fixam o fuso.
Depois de publicar, rode o fluxo contra produção — foi só assim que este apareceu:

```
npm run fluxo -- --url https://casco.aionixdev.com
```

Três armadilhas que custaram caro e estão anotadas no código:

- **Use `localhost`, nunca `127.0.0.1`, no `next dev`.** São origens diferentes para o
  navegador, o Next 16 recusa servir os pacotes do cliente para a origem errada, e a
  recusa é silenciosa: a página abre, navega e grava — porque formulário e link são HTML
  puro — mas o React nunca assume. Nada aparece no console.
- **O React 19 limpa o formulário quando a action termina**, inclusive em erro. Devolva os
  valores digitados no estado e remonte o formulário, senão a operadora perde tudo que
  preencheu ao errar um dígito.

## Estrutura

```
src/
  app/         rotas (App Router), inclusive app/(app)/ajuda/
  components/  ui/ (primitivos), layout/ (shell, sidebar, topbar), ajuda/ (Central de Ajuda)
  db/          schema Drizzle, cliente, withTenant
  lib/         utilidades, auth, ajuda.ts (índice de artigos)
  modules/     lógica por domínio (clientes, vasilhame, vendas, ...)
docs/          auditoria, arquitetura, modelo de dados, roadmap
```

## Infra

Vercel (app) · Railway (Postgres + PgBouncer) · GitHub (deploy automático na `main`).
Nunca commitar `.env*`. Dados reais do cliente não entram no repositório.
