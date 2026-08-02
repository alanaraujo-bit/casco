# Roadmap — etapas e níveis

Princípio de execução: **uma etapa por vez, terminada de verdade.**
Nada avança enquanto a etapa atual não passar pelos três níveis. Qualidade antes de
velocidade — não existe "volto depois pra arrumar".

## Foco atual: o ERP do escritório

Decisão de 30/07/2026: **o app do entregador sai do caminho crítico.** O alvo é
entregar à JM o sistema que o dono e a operadora de balcão usam todo dia, substituindo
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

O usuário da JM já sabe operar um sistema. Nosso trabalho **não é ensinar um sistema novo**
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
  > **Desvio consciente.** A JM tem login por e-mail e senha, e nada mais. O que
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
  > Fature, sem a qual a JM recomeçaria o cadastro do zero.
- **Produtos** ✅ *(Nível 1 — lendo e gravando no banco)*
  Listagem com busca, ordenação e Exportar Excel; cabeçalho de métricas
  (Total · Ativos · Retornáveis · Sem preço); cadastro e edição com campos
  condicionais (estoque mín/máx só aparece se controla estoque; vasilhame só
  aparece se retornável); validação de NCM; inativar em vez de apagar.
  Alerta visual para produto sem preço e estoque abaixo do mínimo.
- **Fornecedores** ✅ *(Nível 1 — lendo e gravando no banco)*
  Listagem com busca, métricas (Total · Com CPF/CNPJ · Com telefone · Inativos);
  cadastro e edição com máscara de CPF/CNPJ e telefone; detecção de documento
  duplicado; inativar em vez de apagar.
- **Tabelas de preço** ✅ *(Nível 1 — lendo e gravando no banco)*
  Listagem em cards com contagem de produtos; criação com flag de tabela padrão
  (ao marcar, desmarca a anterior); edição de preços inline por produto com
  left join mostrando o preço padrão como referência; inativar/reativar.

### Etapa 2 — Vasilhame ✅ ← *o diferencial*
*Pequena, autocontida, e é o que ganha o cliente.*

- **Movimentos com `motivo`** ✅ — os oito, com o sinal derivado do motivo:
  a operadora escolhe o que aconteceu e digita quantos galões, sempre positivo.
  As travas de sinal e de cliente moram no banco (`migrations/0005`), e o
  `esquema.ts` as repete em português para que a tela nunca chegue perto delas.
- **Saldo por cliente** ✅ — mantido por trigger, nunca escrito pela aplicação.
  Cabeçalho com galões na rua, clientes devendo, devolvidos e perdidos no mês,
  e atalho para os maiores saldos.
- **Tela de baixa rápida** ✅ — motivo primeiro, em botões de 44px; saldo do
  cliente visível *antes* de gravar; recibo com o novo saldo, para repetir ao
  cliente antes dele sair; e o painel "Isto não é uma venda" com o custo do
  lançamento, no momento em que ela faria a venda de R$ 0,13.
- **Extrato por cliente** ✅ — auditável galão a galão, com saldo corrente por
  função de janela, particionado por vasilhame (devolver um 10L não abate um 20L).
- **Perda vira custo, nunca receita** ✅ — custo congelado no lançamento, lido
  da view `vasilhame_perdas`. Uma fonte só, que o DRE vai reusar na Etapa 6.
- **Estorno** ✅ *(não estava previsto — `migrations/0007`)* — movimento é
  imutável por trigger, então corrigir é lançar o contrário com o mesmo motivo.
  A view de perdas ignora estorno e estornado: sem isso, um `quebrado 50`
  digitado errado custaria no DRE para sempre, e teríamos trocado a receita
  inflada do sistema antigo por um custo inflado no nosso.

Coberto por 6 provas de banco (`npm run db:provar`, 23 no total) e 14 checagens
do `npm run fluxo`, no desktop e no celular, incluindo o custo aparecendo antes
de gravar e sumindo depois do estorno.

> Motivos ligados a venda (`entregue`/`devolvido`) só fecham na Etapa 3 — hoje
> são lançados à mão, que é o que a JM precisa desde o primeiro dia. As baixas
> internas, o problema real, funcionam por inteiro aqui.

> **Falta para o Nível 3:** filtro por período e por motivo na listagem de
> movimentos (hoje só a busca em texto da `TabelaDados`), e a baixa em lote —
> a conferência de retorno do caminhão lança um cliente por vez.

### Etapa 3 — Vendas ← *em andamento*

- **PDV** ✅ *(Nível 1 e 2 — gravando no banco)*
  Catálogo com o preço já resolvido pela tabela do cliente, carrinho por clique
  (clicar de novo soma um), cliente opcional, desconto em reais, troco calculado
  antes de fechar, e recibo que fica na tela com total, troco e saldo de galões.
  Fechar uma venda é **uma transação e seis tabelas**: `vendas` + `venda_itens`,
  saída em `estoque_movimentos` ao custo médio vigente, `entregue`/`devolvido` em
  `vasilhame_movimentos`, e então **ou** entrada em `caixa_movimentos` com a taxa
  da maquininha descontada, **ou** parcelas em `contas_receber`. Ou as seis
  acontecem, ou nenhuma.
- **Vendas de Produtos** ✅ *(Nível 1)* — listagem com as colunas deles, mais
  cabeçalho de métricas (Vendido hoje · no mês · ticket médio · **taxas no mês**).
  "Recebido" e "A Receber" são derivados de `pagamentos` e `contas_receber`, não
  campos gravados na venda: no sistema deles as duas colunas param de bater no
  dia em que alguém baixa um título por fora.
- **Vasilhame integrado à venda** ✅ — o contador de "galões que ele trouxe" mora
  na linha do item, que é onde a pergunta é feita no balcão. Fecha os motivos
  `entregue`/`devolvido` que a Etapa 2 deixou para lançamento manual.
- Orçamento — pendente
- Comissão por vendedor — pendente (a coluna existe e a listagem já a mostra;
  falta percentual por vendedor no cadastro de usuários, e até lá vale zero)

Coberto por 14 checagens do `npm run fluxo`, no desktop e no celular: venda em
dinheiro com troco, o comodato entrando no saldo do cliente, e a venda fiada
virando título em Contas a Receber.

Três decisões que valem revisão com o cliente:

- **Preço não vem do navegador.** O carrinho manda produto e quantidade; o
  servidor resolve tabela do cliente → tabela padrão → preço do cadastro. Só o
  desconto é digitado, e fica como coluna própria para o relatório conseguir
  responder "quanto demos de desconto no mês".
- **Falta de estoque não trava a venda.** O saldo aparece em vermelho antes.
  Travar com o cliente na frente é como se ensina a operadora a lançar por fora:
  estoque negativo é problema visível, venda fora do sistema é invisível.
- **Venda avulsa não gera comodato.** `entregue` é dívida, e dívida precisa de
  devedor. Sem cliente identificado o contador nem aparece — e a tela avisa,
  antes de fechar, que os galões retornáveis não serão registrados.

> **Lacuna conhecida:** não tivemos acesso ao PDV do sistema atual ("Acesso negado").
> O fluxo acima foi desenhado a partir das colunas da listagem de vendas.
> **Validar com o cliente antes do Nível 3** — é a etapa de maior risco de retrabalho.

> **Falta para o Nível 3:** uma forma de pagamento por venda (pagamento dividido
> entre dinheiro e cartão ainda não existe), atalhos de teclado além do Enter na
> busca, e cancelamento de venda — hoje o status `cancelada` existe no banco e
> não tem tela.

### Etapa 4 — Financeiro
- Contas a Receber e a Pagar, com as colunas deles
- Caixa e formas de pagamento
- A Prazo (gera conta a receber automaticamente)

### Etapa 5 — Estoque ✅ *(Nível 1 e 2 — gravando no banco)*

Antes desta etapa o estoque só sabia descer: a 0006 criou as tabelas e o PDV
dava baixa, mas nenhuma tela dava entrada. Depois de algumas vendas o saldo
ficava negativo e o alerta de mínimo disparava para sempre.

- **Saldo em Estoque** ✅ — as dez colunas de `Control/Warehouse` na mesma
  ordem (Código · Descrição · Complemento · Categoria · Qtdade Disponível ·
  Custo Médio Unit. · Valor Venda · Estoque Máximo · Mínimo · NCM), as três
  últimas escondidas por padrão. Cabeçalho com itens controlados, abaixo do
  mínimo, sem estoque e valor em estoque ao custo médio.
- **Movimentos** ✅ — o razão completo, com estorno em dois toques. A baixa de
  venda não oferece estorno: desfazer uma venda é cancelar a venda.
- **Novo movimento** ✅ — `producao` · `compra` · `ajuste` · `perda` ·
  `devolucao`, com o tipo primeiro e como botão. **Produção e compra são tipos
  distintos** porque a JM é fábrica: o galão envasado não deve nada a ninguém,
  a tampa e o lacre vêm de fornecedor. Um `entrada` genérico obrigaria a
  adivinhar qual era, meses depois, olhando se o fornecedor está preenchido.
- **O ajuste pergunta a contagem, não a diferença** ✅ — ela contou 145, a tela
  calcula o `−5` e mostra o lançamento antes de gravar.
- **Compra gera Conta a Pagar** ✅ — na mesma transação do movimento. Ou a
  mercadoria entra e a dívida existe, ou nenhuma das duas.
- **Extrato por produto** ✅ — saldo corrente por função de janela.

Duas correções no custo médio, as duas achadas pelas provas de banco
(`migrations/0011_estoque.sql`):

- **Estorno de entrada** caía no ramo da saída: devolvia a quantidade e deixava
  o custo médio onde a compra errada o pôs. Agora remove a camada em valor.
- **Entrada sem custo digitado** entrava a zero. Achar 3 galões a mais na
  contagem derrubava o custo médio de R$ 4,50 para R$ 4,41 — o estoque não
  ficou mais barato, nós é que registramos errado.

Coberto por 40 provas de banco (eram 23) e 120 checagens do `npm run fluxo`.

> **Falta para o Nível 3:** nota de compra com vários itens (hoje é um produto
> por lançamento), filtro por período e por tipo na listagem, e ficha técnica
> de insumos — o custo do envase é digitado, não calculado a partir de tampa,
> lacre e rótulo. **A pergunta em aberto com o cliente:** de onde a operadora
> tira o custo do galão envasado. Enquanto não sabemos, o campo vem
> pré-preenchido com o custo médio vigente e ela confirma.

### Etapa 6 — Dashboard e Relatórios ✅ *(Nível 1 e 2 — lendo do banco)*
*Depois que existe dado real para relatar.*

É a etapa que ataca os defeitos (a), (b) e (c) da auditoria de uma vez — os três
são do mesmo tipo: números que o sistema deles não sabe dizer, e diz assim mesmo.

- **DRE que fecha** ✅ — por competência, mês na URL. Lá as linhas de custo e
  despesa exibem literalmente `NaN`, e o lucro líquido junto. `NaN` não nasce de
  conta errada: nasce de dividir por um total que ninguém garantiu que existe.
  Aqui a base da análise vertical devolve `null` quando não há receita no mês, e
  a tela mostra um travessão em vez de afirmar "0,0% da receita".
- **A compra não conta duas vezes** ✅ — `contas_pagar.origem` (`migrations/0012`).
  A compra de mercadoria gera dois registros na mesma transação: a entrada no
  estoque e o título a pagar. Somar o CMV das saídas *e* as contas de natureza
  `custo` contaria a mesma mercadoria uma vez quando chega e outra quando sai.
  Dava para excluir pela `categoria`, e aí o dia em que alguém traduzisse aquele
  rótulo o DRE mudaria de resposta sem ninguém tocar no relatório.
- **Perda de vasilhame como linha de custo visível** ✅ — com o nome do que
  aconteceu, e o detalhamento por motivo ao lado. No sistema deles cada galão
  quebrado vira uma venda de centavos e **sobe** o faturamento.
- **Fluxo de Caixa Diário e Mensal — 12 meses** ✅ — a régua vem do
  `generate_series`, não das linhas da tabela. O deles vai de janeiro a outubro
  porque novembro e dezembro não tinham lançamento; mês parado é uma resposta,
  linha ausente não é. O Diário traz as colunas deles mais o acumulado, partindo
  do saldo anterior ao mês.
- **Painel Gerencial com o que a Etapa 3 destravou** ✅ — faturamento, vendido
  hoje, resultado do mês, ticket médio e mix de produtos. O resultado usa **as
  mesmas fontes do DRE**, não uma segunda contabilidade escrita no painel. No
  deles, custo e despesa aparecem como `0,00` e Faturamento = Lucro Bruto =
  Lucro Líquido = R$ 86.134,08 — uma fábrica de água com custo zero.
- **O mês fecha no fuso da loja** ✅ — `date_trunc` sobre `timestamptz` fecha em
  UTC, então um galão quebrado às 21h de 31 de julho em Tucumã caía no DRE de
  agosto. Sozinho, sem lançamento correspondente, num mês que a operadora já
  tinha fechado e conferido. As views de perda e de CMV convertem antes de
  truncar.

Duas coisas foram achadas rodando, e nenhuma delas `tsc` veria:

- **O DRE levava 15,1 s** e estourava o próprio roteiro. Eram subconsultas
  correlacionadas reexecutadas uma vez por mês, e as views de perda carregam um
  `not exists` por linha. Cada fonte passou a ser agregada uma vez e casada com
  a régua depois: **3,7 s**. O Diário fazia 31 varreduras de `caixa_movimentos`;
  o Mensal, 12.
- **No celular a barra deixava 76px para o título** — medidos. "Fluxo de Caixa
  Mensal" virava "Fluxo d…" e as duas telas de fluxo ficavam indistinguíveis
  exatamente onde o usuário precisa saber onde está. O seletor de tema comia
  140px, 36% da largura do telefone, em toda tela, para uma preferência que se
  ajusta uma vez: foi para dentro do menu da conta, com rótulo e os mesmos 44px.

Coberto por 147 checagens do `npm run fluxo` (eram 120), no desktop e no celular,
incluindo a que prova que a compra de estoque fica fora de "Outros custos" — se a
exclusão por origem quebrar, a linha vira R$ 330,00 em vez de R$ 300,00.

> **Falta para o Nível 3:** exportar o DRE e os fluxos em PDF e Excel — hoje só
> a `TabelaDados` exporta, e estes três relatórios não a usam, porque a ordem
> cronológica *é* o relatório e uma coluna de acumulado reordenada por "maior
> entrada" não significa nada. Comparativo com o mesmo mês do ano anterior no
> DRE. E **Conciliação Bancária**, a quarta tela de Relatórios do legado, que
> continua em `PROXIMAS`.
>
> **A pergunta em aberto com o cliente:** o regime do DRE é competência, com as
> contas a pagar entrando pela **emissão**. Se o contador da JM fechar por
> caixa, a linha de despesa muda de mês — vale confirmar antes do Nível 3.

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
  → 5 Estoque → 6 Relatórios ✅ ┊ (7 Rotas — adiada)
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
| Acesso ao PDV do sistema atual | Etapa 3 (Nível 3) — construído sem ele, validar |
| Confirmar emissão de NF-e | Etapa 3 |
| Onde cai a venda do porta a porta (auditoria §1.1) | Etapa 3 |
| Quais módulos eles realmente usam | Etapa 6 — construída sem isso; Conciliação Bancária ficou de fora até confirmarmos |
| Se o contador fecha o DRE por competência ou por caixa | Etapa 6 (Nível 3) |
| Nome do produto | Etapa 0 |
