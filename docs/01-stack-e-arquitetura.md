# Aionix — Sistema para Distribuidora de Água
## Decisão de stack e arquitetura

> Base das decisões: multi-tenant desde o dia 1 · app do entregador **offline-first** ·
> sem emissão fiscal (só recibo/comprovante) · sem prazo prometido ao cliente.

---

## 1. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Front + API | **Next.js 16 (App Router) + TypeScript** | Um só codebase serve desktop e PWA. Server Components cortam o JS enviado ao celular do entregador. |
| Banco | **Postgres no Railway** | Postgres puro, sem vendor lock. RLS nativa é o mecanismo de isolamento multi-tenant. Já contratado. |
| ORM | **Drizzle** | SQL-first, migrations versionadas, tipagem real. Prisma pesa demais em serverless. |
| Auth | **Auth.js (NextAuth) v5** | Sessão em JWT com `company_id` e papel embutidos. Sem depender de provedor externo. |
| UI | **Tailwind + shadcn/ui (Radix)** | Acessibilidade e teclado de graça; visual 100% customizável — é o que permite o "premium" sem cara de template. |
| Gráficos | **Recharts** | Dashboard e relatórios (o ponto que você achou mais feio no legado). |
| Arquivos | **Vercel Blob** | Foto de comprovante de entrega. Fica no mesmo provedor do app. |
| Offline | **Dexie (IndexedDB) + outbox + Service Worker** | Núcleo do app do entregador. Detalhado na seção 3. |
| Hospedagem | **Vercel** (app) + **Railway** (banco) | Ferramentas já contratadas, ambas com CLI. |
| CI/CD | **GitHub → Vercel** | Push na `main` faz deploy sozinho. PR gera preview com URL própria. |

### O ponto de atenção da combinação Vercel + Railway

Vercel roda serverless: cada requisição pode abrir uma conexão nova com o Postgres.
Sem cuidado, o Railway estoura o limite de conexões em produção — e isso aparece
justamente sob carga, no pior momento.

Solução, decidida agora e não depois: **PgBouncer em modo transaction** como serviço no
Railway, com o app conectando via `postgres.js` (`max: 1`, `prepare: false`).
É configuração de meia hora na Etapa 0 que evita um incidente na Etapa 6.

**Descartado:** Expo/React Native. PWA bem-feito entrega 95% da experiência nativa aqui,
sem loja, sem build nativo, sem review — e atualiza na hora. Se um dia precisar de loja,
o mesmo código entra num wrapper.

---

## 2. Multi-tenancy

Toda tabela de negócio carrega `company_id uuid not null`. O isolamento **não** fica na
aplicação — fica no banco, via Row Level Security:

```sql
alter table clientes enable row level security;

create policy tenant_isolation on clientes
  using (company_id = current_setting('app.company_id', true)::uuid);
```

Como o Postgres é nosso (Railway) e não do Supabase, quem preenche `app.company_id` é a
aplicação, no início de **toda** transação:

```ts
// wrapper único — nenhuma query de negócio roda fora daqui
export async function withTenant<T>(companyId: string, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
    return fn(tx);
  });
}
```

O `true` no `set_config` é o detalhe que importa: torna o valor **local à transação**,
então uma conexão reciclada pelo PgBouncer nunca carrega o tenant da requisição anterior.

Consequência prática: **um bug de query não vaza dado entre distribuidoras** — o Postgres
recusa antes. É a diferença entre um produto revendável e um acidente esperando acontecer.

Regra dura: nenhuma query de negócio usa o papel dono do banco. Se precisar, é sinal de
modelagem errada.

---

## 3. Offline-first do entregador

É a peça mais difícil e o maior diferencial. Modelo:

**Escrita — outbox.** O entregador nunca escreve direto na rede. Toda ação (entrega
concluída, recebimento, vasilhame retornado) vira um registro local com
`id` gerado no cliente (UUID v7, ordenável por tempo). Uma fila persistente sincroniza
quando há sinal.

**Idempotência.** O UUID vem do dispositivo, então reenviar a mesma operação é inofensivo —
o servidor faz `on conflict (id) do nothing`. Isso elimina a classe inteira de bugs de
"cliente cobrado duas vezes porque a rede caiu no meio".

**Conflito.** A rota do dia é *particionada por entregador*: cada um só escreve nas próprias
entregas. Sem escritor concorrente, não há merge — só ordenação. Os poucos casos de conflito
real (estoque do caminhão) resolvem no servidor por saldo, não por sobrescrita.

**Leitura.** No início da rota, baixa o pacote do dia (clientes, preços, saldo de vasilhame,
paradas) para o IndexedDB. A partir daí a tela lê do local e funciona em modo avião.

---

## 4. Os dois alvos de UI

**Desktop — ferramenta de trabalho, não site.** Densidade alta, atalhos de teclado, o PDV
operável sem tirar a mão do teclado. Quem passa 8h no sistema quer eficiência, não respiro visual.

**Mobile — PWA que não parece web.** Isso é engenharia, não CSS:

- `user-scalable=no` + `touch-action: manipulation` → sem zoom acidental
- `font-size: 16px` em todo input → impede o iOS de dar zoom no foco
- `-webkit-touch-callout: none` + `user-select: none` fora de campos de texto → sem menu de "colar"
- `overscroll-behavior: none` → sem bounce de rolagem da página
- `display: standalone` + `viewport-fit: cover` + safe-area insets → tela cheia, sem barra do browser
- Alvos de toque ≥ 44px, navegação no polegar (barra inferior), nunca no topo

---

## 5. O que o legado não tem — nosso diferencial

Levantado da auditoria (ver `00-auditoria-sistema-legado.md`). Ordenado por dor real
observada nos dados do cliente, não por suposição:

1. **Controle de vasilhame: quebra, perda e comodato.** É a dor nº 1, confirmada pelo
   cliente. Não existe lugar no legado para lançar galão quebrado, trincado ou que voltou
   vazio — então a operadora registra **vendas falsas de centavos**
   (`BAIXA DE GALÃO — CHEIOS`, R$ 0,13; `2 TRINCADAS 2 BAIXAS`, R$ 0,08) só para dar baixa.
   Cada galão quebrado vira uma linha de receita falsa. É isso que corrompe o DRE.

   O que precisamos: **movimento de vasilhame como entidade própria**, com motivo
   (entregue · devolvido · quebrado · trincado · perdido · levado para a fábrica),
   sem passar pelo financeiro. Baixa de galão é evento de estoque, nunca venda.
2. **O canal de varejo porta a porta.** Os 30 cadastros do legado são todos revendas —
   nenhum consumidor final. Onde a venda de varejo cai hoje ainda não está confirmado
   (ver auditoria §1.1). Confirmar antes de modelar.
3. **App do entregador offline** — inexistente no legado. Entre Tucumã e Ourilândia,
   e em bairro periférico, o sinal cai; sem offline o app é inútil.
4. **Rotas nos dois modelos** — atacado (poucas paradas, alto volume) e varejo porta a
   porta (muitas paradas, baixo volume, recorrência semanal). Mesma estrutura de dados,
   cadências e telas diferentes.
5. **Recorrência / assinatura** — o cliente que recebe 2 galões toda terça. É o que
   transforma a rota de varejo em algo planejável em vez de reativo.
6. **Preço por cliente** — revenda, mercadinho e consumidor final pagam diferente.
7. **Dashboard e DRE corretos** — os do legado exibem `NaN` e custo zero (ver auditoria §4).
   Não é diferencial de feature, é o básico funcionando. É o que eles reclamam.
8. **WhatsApp** — pedido e aviso de saída para entrega. Depende de arrumar o cadastro
   (só 4 dos 30 clientes atuais têm telefone).
9. **Fidelidade** — "a cada 10 galões, 1 grátis". Prática comum no varejo do setor;
   confirmar se a LM já faz isso na planilha.

Os itens 1, 2 e 3 sozinhos já justificam a troca de sistema.

### O objetivo real do projeto
**Matar as planilhas.** Todo dado que hoje vive fora do sistema é dado que ninguém
consegue conferir, somar ou auditar. A régua de sucesso não é "temos as telas deles
mais bonitas" — é o dono conseguir olhar um número só e confiar nele.
