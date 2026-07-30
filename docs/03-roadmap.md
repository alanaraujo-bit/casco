# Roadmap — etapas e níveis

Princípio de execução: **uma etapa por vez, terminada de verdade.**
Nada avança enquanto a etapa atual não passar pelos três níveis. Qualidade antes de
velocidade — não existe "volto depois pra arrumar".

---

## A regra da familiaridade

O usuário da LM já sabe operar um sistema. Nosso trabalho **não é ensinar um sistema novo**
— é entregar o mesmo mapa mental, bem executado. Regras duras:

| Mantemos igual | Mudamos |
|---|---|
| **Vocabulário exato** — "Contas a Receber", "Fluxo de Caixa Diário", "Baixa Estoque", "Orçamento". Nunca "Recebíveis" ou "Financeiro › Entradas". | Tipografia, cor, densidade, espaçamento |
| **Grupos de menu** — Vendas · Cadastro · Financeiro · Estoque · Relatórios | Velocidade (1–2 queries no lugar de 50) |
| **Colunas das tabelas**, na mesma ordem que eles já leem | Estados: carregando, vazio, erro, offline |
| **Número de passos** das tarefas do dia a dia | Validação e prevenção de erro |
| Códigos e formatos que eles usam (`0002 - DANIEL`) | Comportamento no mobile |

**Teste de decisão:** ao mudar um fluxo, ele precisa ser obviamente melhor em **5 segundos**
de uso. Se exigir explicação, mantém como está no sistema antigo. Ganhar discussão de
usabilidade não vale perder a adoção.

Exceção única: onde o sistema deles **força o erro** — o caso da baixa de galão lançada
como venda. Aí mudamos e explicamos, porque é o motivo da troca.

---

## Os três níveis

Toda etapa atravessa os mesmos três níveis antes de ser considerada pronta:

**Nível 1 — Funciona.**
Regra de negócio correta, dados persistindo, multi-tenant isolado, sem caminho quebrado.
Feio é aceitável aqui. Errado não é.

**Nível 2 — Fluido.**
Carregando · vazio · erro · sem permissão. Validação com mensagem útil.
Teclado funciona de ponta a ponta. Nada trava, nada pisca, nada perde o que foi digitado.

**Nível 3 — Premium.**
Densidade certa para 8h de uso, atalhos, foco visível, microinterações, mobile impecável.
É aqui que o sistema deixa de parecer um CRUD.

**Critério de saída de qualquer etapa:** rodar o fluxo real de ponta a ponta, no desktop
e no celular, com dados de verdade. Build passando não conta como pronto.

---

## Etapas

### Etapa 0 — Fundação
*Nenhuma tela de negócio. É o chão onde todo o resto pisa.*

- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase + Drizzle, migrations versionadas
- Multi-tenant: `company_id` em tudo, RLS ligada, `company_id` no JWT
- Auth: login, sessão, papéis (dono · operador · entregador)
- **Shell da aplicação**: sidebar espelhando os grupos de menu deles, topbar, breadcrumb
- **Design system**: paleta, tipografia, escala de espaçamento, tokens, dark mode
- **Componente de tabela de dados** — paginação, ordenação, filtro, densidade,
  exportar. Vai ser reusado em ~15 telas; feito bem uma vez, paga o projeto inteiro
- PWA: manifest, service worker, e as travas de mobile (sem zoom, sem seleção, sem bounce)

> Etapa mais longa e a que menos aparece. É proposital: cada tela depois sai em uma
> fração do tempo porque a fundação já resolveu o difícil.

> **Critério de aceite herdado da revisão da 0.4:** a região `aria-live` do
> carregamento tem que morar no container do DataTable, que persiste entre
> "carregando" e "carregado" — não no skeleton, que é substituído. Hoje o
> leitor de tela anuncia "Carregando…" na montagem e nunca anuncia que
> terminou.
>
> **Validar na Etapa 4, com os 111 lançamentos reais de Contas a Receber:** a
> escala tipográfica subiu um degrau (corpo de 13px para 14px), o que custa
> cerca de 5% das linhas por tela. Se a operadora reclamar de rolagem, o
> ajuste é `--text-sm` voltar para 13px **mantendo** o piso de 12px nos selos
> — não desfazer a escala.

### Etapa 1 — Cadastros
*Clientes primeiro — é a melhor tela do sistema deles e a base de todo o resto.*

- **Clientes** — com os 3 modos que eles já usam (Tabela · Cards · Lista), busca,
  Exportar Excel, e o cabeçalho de métricas (Total · Com CPF/CNPJ · Com contato).
  Adicionamos: endereço com georreferência e tipo de cliente (revenda · mercado · consumidor)
- **Produtos** — incluindo a marcação de retornável e o vínculo com o vasilhame
- **Fornecedores**
- **Tabelas de preço** — revenda, mercadinho e consumidor final pagam diferente

### Etapa 2 — Vasilhame ← *o diferencial*
*Pequena, autocontida, e é o que ganha o cliente.*

- Movimentos com `motivo`: entregue · devolvido · quebrado · trincado · perdido ·
  enviado à fábrica · retornou da fábrica · ajuste de inventário
- Saldo por cliente ("quem está devendo galão")
- Tela de baixa rápida — o que hoje ela faz criando venda de R$ 0,13
- Extrato por cliente, auditável galão a galão
- Perda vira **custo** no financeiro, nunca receita

> Motivos ligados a venda (`entregue`/`devolvido`) só fecham na Etapa 3.
> As baixas internas — o problema real — funcionam já aqui.

### Etapa 3 — Vendas
- Registro de venda com as colunas que eles já leem: Operação · Código · Data · Cliente ·
  Vendedor · Comissão · Tipo Venda · Parcelas · Valor · Recebido · Taxas · A Receber
- Venda avulsa (balcão) e venda com cliente
- Orçamento
- Comissão por vendedor
- Vasilhame integrado à venda

> **Lacuna conhecida:** não tivemos acesso ao PDV do sistema atual ("Acesso negado").
> Esta etapa é desenhada a partir das colunas da listagem de vendas. **Validar o fluxo
> com o cliente antes do Nível 3** — é a etapa de maior risco de retrabalho.

### Etapa 4 — Financeiro
- Contas a Receber e a Pagar, com as colunas deles
- Caixa e formas de pagamento
- Fiado (gera conta a receber automaticamente)

### Etapa 5 — Estoque
- Saldo, entradas, custo médio, estoque mínimo/máximo
- Movimentação ligada a venda e a vasilhame

### Etapa 6 — Dashboard e Relatórios
*Depois que existe dado real para relatar.*

- Dashboard em 1–2 queries agregadas (contra ~50 chamadas do legado)
- **DRE que fecha** — sem `NaN`, com custo de verdade
- Fluxo de Caixa Diário e Mensal — **12 meses**, não 10
- Perda de vasilhame como linha de custo visível

### Etapa 7 — Rotas e app do entregador
*A mais difícil. Precisa de tudo que veio antes.*

- Montagem de rota, carga do caminhão, ordem de visita
- App do entregador em PWA, **offline-first** (Dexie + outbox, UUID v7 no device)
- Confirmação de entrega com geolocalização
- Conferência de retorno: vasilhame que voltou, quebrado, e dinheiro

---

## Ordem e por quê

```
0 Fundação → 1 Cadastros → 2 Vasilhame → 3 Vendas → 4 Financeiro
  → 5 Estoque → 6 Relatórios → 7 Rotas
```

- **Cadastros antes de tudo**: nada funciona sem cliente e produto.
- **Vasilhame cedo**: é a dor nº 1, é autocontido, e é a demo que fecha a adoção.
- **Relatórios tarde**: relatório sem dado real é decoração.
- **Rotas por último**: é o mais difícil, e depende de venda, estoque e vasilhame prontos.

---

## Pendências que não bloqueiam o começo

| Item | Bloqueia a partir de |
|---|---|
| Acesso ao PDV do sistema atual | Etapa 3 (Nível 3) |
| Confirmar emissão de NF-e | Etapa 3 |
| Onde cai a venda do porta a porta (auditoria §1.1) | Etapa 3 |
| Quais módulos eles realmente usam | Etapa 6 |
| Nome do produto | Etapa 0 |
