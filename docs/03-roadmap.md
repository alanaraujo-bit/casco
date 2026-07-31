# Roadmap — etapas e níveis

Princípio de execução: **uma etapa por vez, terminada de verdade.**
Nada avança enquanto a etapa atual não passar pelos três níveis. Qualidade antes de
velocidade — não existe "volto depois pra arrumar".

## Foco atual: o ERP do escritório

Decisão de 30/07/2026: **o app do entregador sai do caminho crítico.** O alvo é
entregar à LM o sistema que o dono e a operadora de balcão usam todo dia, substituindo
o Fature Gestão. A Etapa 7 (rotas e app de campo) fica adiada, não cancelada.

O que isso muda:

- **Offline-first sai do escopo imediato.** O escritório tem internet; era o caminhão
  que não tinha. A modelagem continua preparada (UUID v7 gerado no cliente,
  idempotência por `id`), porque desfazer isso depois custaria caro e mantê-lo não
  custa nada agora.
- **Alvos de toque de 44px continuam.** Não é concessão ao entregador: é o que faz o
  sistema funcionar no celular do dono, que vai querer olhar o faturamento fora da loja.
- **Vasilhame continua sendo a Etapa 2 e o diferencial.** Não é módulo de campo — a
  baixa de galão quebrado é lançada no balcão, e é justamente o buraco que faz a
  operadora registrar venda de R$ 0,13 hoje.

O que fica adiado: montagem de rota, app de campo, fila de sincronização, confirmação
de entrega com geolocalização.

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

- **0.1** Next.js 16 (App Router) + TypeScript + Tailwind v4 ✅
- **0.2** Postgres no Railway + Drizzle + RLS por `company_id` + runner de migrations ✅
  — banco no ar, 20 tabelas com RLS e `force`, isolamento provado a cada deploy
- **0.3** ~~Auth.js v5~~ **sessão própria**: login, sessão com `company_id` e papel,
  guard em `proxy.ts` ✅
  > **Desvio consciente.** A LM tem login por e-mail e senha, e nada mais. O que
  > sobraria do Auth.js seria o provider de credenciais — justamente a parte que
  > ele pede para você escrever inteira. Trocaríamos ~80 linhas explícitas por uma
  > dependência em beta acoplada a uma versão do Next que acabou de renomear o
  > middleware. Está tudo atrás de `lerSessao()`: no dia em que precisar de OAuth,
  > a troca é local.
- **0.4** Design system: paleta OKLCH em dois temas, tipografia, tokens, estados ✅
- **0.5** **Shell da aplicação**: sidebar espelhando os grupos de menu deles, topbar
- **0.6** **Componente de tabela de dados** — paginação, ordenação, filtro, densidade,
  exportar. Vai ser reusado em ~15 telas; feito bem uma vez, paga o projeto inteiro
- **0.7** PWA e responsividade: manifest, e as travas de mobile (sem zoom, sem seleção
  acidental, sem bounce). Escopo reduzido — sem service worker offline, já que o app
  de campo saiu do caminho crítico

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

- **Clientes** ✅ *(Nível 1 e 2 — lendo e gravando no banco)*
  Listagem com busca, ordenação, colunas configuráveis e Exportar Excel; cabeçalho de
  métricas (Total · Com CPF/CNPJ · Com contato · Galões na rua); cadastro e edição com
  os dezesseis campos, validação de CPF/CNPJ pelos dígitos verificadores, máscara ao
  digitar, e inativar em vez de apagar. Endereço com ponto de referência e tipo de
  cliente definindo a tabela de preço.
  Coberto por 23 checagens do `npm run fluxo`, no desktop e no celular.

  > **Falta para o Nível 3:** os 3 modos de visualização que eles já usam
  > (Tabela · Cards · Lista) — hoje só existe Tabela. E a importação da planilha do
  > Fature, sem a qual a LM recomeçaria o cadastro do zero.
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

### ~~Etapa 7 — Rotas e app do entregador~~ — **ADIADA**
*Fora do caminho crítico desde 30/07/2026. Entra depois da entrega do ERP.*

- Montagem de rota, carga do caminhão, ordem de visita
- App do entregador em PWA, **offline-first** (Dexie + outbox, UUID v7 no device)
- Confirmação de entrega com geolocalização
- Conferência de retorno: vasilhame que voltou, quebrado, e dinheiro

> O que fica preservado desde já, porque desfazer depois custa caro e manter agora
> não custa nada: `id` gerado no cliente com UUID v7, endereço desnormalizado em
> `clientes`, e `sync_outbox_log` no modelo de dados.

---

## Ordem e por quê

```
0 Fundação → 1 Cadastros → 2 Vasilhame → 3 Vendas → 4 Financeiro
  → 5 Estoque → 6 Relatórios ┊ (7 Rotas — adiada)
```

- **Cadastros antes de tudo**: nada funciona sem cliente e produto.
- **Vasilhame cedo**: é a dor nº 1, é autocontido, e é a demo que fecha a adoção.
  Não é módulo de campo — a baixa de galão quebrado é lançada no balcão.
- **Relatórios tarde**: relatório sem dado real é decoração.
- **Rotas adiada**: a entrega ao cliente é o ERP do escritório. Rota só faz sentido
  depois que venda, estoque e vasilhame estiverem rodando de verdade.

---

## Pendências que não bloqueiam o começo

| Item | Bloqueia a partir de |
|---|---|
| Acesso ao PDV do sistema atual | Etapa 3 (Nível 3) |
| Confirmar emissão de NF-e | Etapa 3 |
| Onde cai a venda do porta a porta (auditoria §1.1) | Etapa 3 |
| Quais módulos eles realmente usam | Etapa 6 |
| Nome do produto | Etapa 0 |
