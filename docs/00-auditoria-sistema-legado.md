# Auditoria — Fature Gestão (sistema atual da JM Distribuidora Natuclara)

Capturado em 30/07/2026 · 42 telas · 360 chamadas de API observadas
Método: navegação **somente leitura** (GET) com Playwright. Nenhum clique, nenhum
formulário submetido, nenhum dado alterado. Artefatos em `recon/out/`.

---

## 1. O negócio do cliente

A JM Distribuidora Natuclara é uma **fábrica de água de 20L** que opera em **dois canais**:

- **Atacado** — venda para revendas de gás e mercados. Está no sistema, com cliente nomeado.
- **Varejo porta a porta** — entrega direta ao consumidor. Confirmado pelo cliente.
  **Onde essas vendas são lançadas ainda não está confirmado** — ver §1.1.

| Evidência no sistema | Valor |
|---|---|
| Clientes cadastrados | **30** — *todos* revendas e mercados, nenhum consumidor final |
| Praças | Tucumã/PA, Ourilândia do Norte/PA, Água Azul (interior do Pará) |
| Produto | `AGUA 20L NATUCLARA` — 569 un. em estoque |
| Ticket médio | **R$ 6,60** por unidade (preço de atacado) |
| Volume | **17.371 unidades** vendidas no mês |
| Faturamento | Jan R$ 65k → Jun R$ 126k → Jul R$ 86k (parcial) |
| Vendedores | 0002 DANIEL · 0004 KAIKE · 0005 BETO |

Clientes típicos no sistema: MANU GAS, TOP GAS, IMPERIAL GAS, FLUMINENSE GAS, UNI GÁS,
MERCADO AVENIDA, COMERCIAL VIEIRA, DISK BREJA, JP MIX.

### 1.1 Pergunta em aberto: onde cai a venda do porta a porta?

Não há **nenhum consumidor final** entre os 30 cadastros, e as 106 vendas visíveis em
`/Sales/Products` são todas de revenda nomeada. Mas a empresa entrega porta a porta
todo dia. Hipótese mais provável, ainda **não verificada**:

> A venda de varejo é lançada como **venda avulsa de balcão, sem cliente vinculado**,
> pelo PDV — exatamente a tela que a conta cedida não deixou acessar ("Acesso negado").

Se for isso, a consequência é que **não existe histórico por consumidor**: quem comprou,
com que frequência, quantos galões está devendo. O dono não consegue responder "quantos
clientes recorrentes eu tenho" nem "quem sumiu esse mês".

**Não construir nada em cima disso antes de confirmar.** É a primeira pergunta a fazer
ao cliente, junto com o acesso ao PDV.

**Implicações de projeto:**
- Precisamos de **dois modelos de rota**: atacado (poucas paradas, alto volume) e
  varejo porta a porta (muitas paradas, baixo volume). Mesma estrutura, cadências diferentes.
- Se a hipótese de §1.1 se confirmar, a base de clientes vai de 30 para **centenas** ao
  cadastrar o varejo. Busca, agrupamento por bairro e cadastro rápido pelo celular
  deixam de ser detalhe de UI e viram requisito.
- Offline é inegociável — interior do Pará, sinal cai entre municípios e em bairro periférico.
- Preço por cliente é essencial: revenda, mercadinho e consumidor final pagam diferente.
- Qualidade de cadastro é péssima: só **4 de 30** clientes têm telefone.

---

## 2. Stack e arquitetura do legado

- **Next.js (Pages Router)** na **Vercel**, `buildId ON4Wau9fIu5-UbPsMlIJj`
- **Supabase** para auth (`/api/supabase/auth/v1/token`) e dados
- Multi-tenant: existem `/api/mintTenantToken` e `/api/validAccess`
- Feature flags por empresa (ex.: "modo de vendas unificado" desativado nesta conta)
- Papéis/permissões existem (o acesso cedido é bloqueado no PDV)

### O gargalo

Toda a aplicação conversa com **um único endpoint genérico: `POST /api/postgres`**.

Só a tela de Dashboard dispara **~50 chamadas** a esse endpoint — uma ida e volta por
widget, sem agregação no banco e sem cache. Nas 42 telas capturadas foram **360 chamadas
de API**. É essa arquitetura, não o volume de dados (são 30 clientes e 106 vendas),
que faz o sistema parecer lento.

Nosso Dashboard equivalente cabe em 1–2 queries agregadas. A diferença vai ser visível
na demonstração.

---

## 3. Mapa de módulos — 47 rotas

| Módulo | Telas |
|---|---|
| **Dashboard** | `/Dashboard` |
| **Vendas** | `PDV` · `Products` · `Services` · `Unified` · `Budget` (orçamento) · `Commission` |
| **Cadastros** | `Clients` · `ProductsServices` · `Professionals` · `Services` · `Supplier` |
| **Financeiro** | `Bill/Payable` · `Bill/Receivable` · `Expenses` |
| **Estoque** | `Control/Warehouse` · `Control/WarehouseInputs` |
| **Fiscal (NF-e)** | `SettingsNF` · `DetailNF` · `CreditNF` · `Inutilizacao` · `NaturezasOperacao` · `TrackNF` |
| **Relatórios** | `DRE` · `DailyCashFlow` · `MonthlyCashFlow` · `ReconciliationsBank` |
| **Analytics** | `SellsViews` · `MonthlyCashFlow` · `ReconciliationsBank` |
| **Outros** | `Schedule/Agenda` · `Etiquetas` · `Proof` · `OuterUsers` · `AdminPage` · `Settings` · `UpgradePlan` · `NewUser` |

### Colunas reais (o que precisamos reproduzir)

**Contas a Receber** — Origem · Código · Cliente/Descrição · Emissão · Valor Total ·
Parcela · Valor Parcela · Vencimento · Recebido? · Banco · Forma Pgto · Taxas ·
Data Pagamento · Valor Pago · *(111 registros)*

**Contas a Pagar** — Parcela · Descrição · Despesa/Custos · Categoria · Tipo ·
Vencimento · Valor Previsto · Data Pagamento · Valor Pagamento · Status ·
Forma Pagamento · Saída Dinheiro · Observação

**Vendas de Produtos** — Operação · Código · Data · Cliente · Vendedor · Comissão ·
Tipo Venda · Parcelas · Valor Venda · Recebido · Taxas · A Receber · Observação ·
N. Orçamento · Valor Não Programado *(106 registros)*

**Estoque** — Código · Descrição · Complemento · Categoria · Qtdade Disponível ·
Custo Médio Unit. · Valor Venda · Estoque Máximo · Estoque Mínimo · NCM

**Fluxo de Caixa Diário** — Data · Dia Semana · Entrada · Saída · Saldo · Banco

**Clientes** — cards com iniciais, PF/PJ, documento, telefone, cidade.
Tem 3 modos de visualização (Tabela · Cards · Lista), Exportar Excel, e um cabeçalho
de métricas: Total · Aniversariantes do mês · Com CPF/CNPJ · Com contato.
*(essa tela é a melhor do sistema — vale manter o conceito)*

---

## 4. Defeitos encontrados em produção

Estes são verificáveis nos screenshots em `recon/out/screens/`.

**a) O DRE está quebrado.** O relatório mais importante para o dono exibe literalmente `NaN`:

```
(-) Custos Vendas / Serviços     (NaN)     0.0%
(-) Despesas Operacionais        (NaN)     0.0%
5. LUCRO LÍQUIDO                  NaN      0.0%
```

**b) O Dashboard mente.** Custos e Despesas aparecem como `0,00`, então
Faturamento = Lucro Bruto = Lucro Líquido = R$ 86.134,08. Uma fábrica de água com
custo zero. O número que o dono olha todo dia está errado.

**c) Fluxo de Caixa Mensal só tem 10 meses** — vai de Jan a Out. Novembro e dezembro
não existem na tabela.

**d) Rotas de teste em produção:** `/Funcionarios (excluir)` e
`/ComprovanteServicos (TESTE)`. A tela `/Proof` responde:
*"Este é apenas um PDF modelo para testar a geração e download do PDF"*.

**e) Contas bancárias fantasma.** Para conseguir lançar histórico, criaram bancos
chamados `RETROATIVO CAIXA ECONOMICA` e formas de pagamento `PIX RETROATIVO`,
`DINHEIRO RETROATIVO`. É o usuário contornando a rigidez do sistema.

---

## 5. O achado central: eles falsificam vendas para controlar galão

O sistema **não tem controle de vasilhame**. Como a operação depende disso, os
funcionários passaram a registrar **vendas falsas de centavos** só para movimentar galão.
Extraído de Contas a Receber e Vendas:

| Descrição da "venda" | Valor |
|---|---|
| `BAIXA DE GALÃO - BETO LEVOU PARA A FABRICA` | R$ 10,49 |
| `BAIXA DE GALÃO - CHEIOS` | R$ 0,13 |
| `QUEBRA GALÃO OURILANDIA — VAZIOS` | R$ 0,07 |
| `QUEBRA GALÃO OURILANDIA — CHEIOS` | R$ 0,04 |
| `2 TRINCADAS 2 BAIXAS` | R$ 0,08 |

Existem inclusive **clientes fictícios** cadastrados só para isso:
`QUEBRA GALÃO FABRICA` e `QUEBRA GALÃO OURILANDIA`.

**Por que isso importa comercialmente:** cada galão movimentado vira uma linha de
receita falsa. É por isso que o faturamento deles não bate com a realidade e o DRE
não fecha. Não é só uma funcionalidade faltando — é uma funcionalidade faltando que
**corrompe a contabilidade inteira**.

Nosso módulo de vasilhame resolve a dor real *e* limpa o financeiro. É o argumento
mais forte da proposta.

---

## 6. Diagnóstico visual

Ver `recon/out/screens/11-Dashboard.png`.

| Problema | Efeito |
|---|---|
| 5 cards em 5 cores saturadas (laranja, roxo, verde, vermelho, azul) | Tudo grita igual; nada tem hierarquia |
| Emojis de dinheiro no lugar de ícones | Amadorismo imediato |
| Laranja #FF6600 em título, borda, tabela, filtro e menu | Fadiga visual em 8h de uso |
| Gráfico com toolbar de zoom/pan/exportar | Complexidade que ninguém usa |
| Tabelas com cabeçalho laranja sólido | Peso visual no lugar errado — o dado deveria dominar |
| Números sem separador consistente (`R$ 65633.68` vs `R$ 1.900,00`) | Formatação inconsistente entre telas |

O sistema não é feio por falta de esforço — é feio por falta de sistema de design.
Cada tela foi decidida isoladamente.

---

## 7. Lacunas do audit — o que não consegui ver

Sendo honesto sobre os limites desta captura:

1. **PDV (`/Sales/PDV`) retornou "Acesso negado"** — a conta cedida não tem permissão.
   É a tela mais importante do sistema e a única que não vi. **Precisamos de um acesso
   com permissão total**, ou de um vídeo/print do cliente usando o PDV.
2. **Formulários de cadastro não foram abertos.** Abrem em modal, e abrir modal exige
   clicar — deliberadamente fora do escopo, para não arriscar criar registro no sistema
   deles. Os campos serão levantados com o cliente.
3. **Telas vazias nesta conta** (Etiquetas, Expenses, Agenda, todas as de NF, Analytics/
   SellsViews) — renderizaram sem dados. Podem estar desativadas por plano/flag, ou o
   cliente simplesmente não as usa. **Vale perguntar quais ele usa de verdade.**
4. **NF-e:** existem 6 telas fiscais, mas nenhuma tinha dado. Precisa confirmar com o
   cliente se ele emite nota hoje — isso muda o escopo materialmente.
