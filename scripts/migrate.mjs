/**
 * Runner de migrations + garantia do papel da aplicacao + prova de isolamento.
 *
 * Roda no build da Vercel (script `build` no package.json), porque este projeto
 * nao executa nada na maquina local.
 *
 * Tres etapas, nesta ordem:
 *  1. Aplica ./migrations em ordem, cada arquivo numa transacao, uma vez so.
 *  2. Garante que o papel `casco_app` existe com a senha do ambiente.
 *  3. CONECTA COMO `casco_app` e prova que o isolamento por RLS funciona de
 *     verdade. Se um tenant enxergar dado de outro, o build falha.
 *
 * A etapa 3 e o ponto do arquivo. Politica de RLS e o tipo de coisa que parece
 * correta em revisao de codigo e nao filtra nada — basta o papel ser
 * superusuario, ou faltar um FORCE. So um teste que le dado de dois tenants e
 * compara consegue dizer a diferenca.
 *
 * Conexoes: migrations e criacao de papel usam DIRECT_DATABASE_URL (dono do
 * banco). A prova usa a mesma URL com credenciais de `casco_app`, que e o que
 * a aplicacao realmente usa em producao.
 */
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const LOCK_ID = 947_233_11;
const PAPEL = 'casco_app';

const urlDono = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const senhaApp = process.env.APP_DB_PASSWORD;

if (!urlDono) {
  console.error('[migrate] DIRECT_DATABASE_URL (ou DATABASE_URL) nao definida.');
  process.exit(1);
}
if (!senhaApp) {
  console.error('[migrate] APP_DB_PASSWORD nao definida — sem ela o papel da aplicacao nao pode ser criado.');
  process.exit(1);
}

const sql = postgres(urlDono, { max: 1, prepare: false, onnotice: () => {} });

/** Monta a URL de conexao do papel restrito a partir da URL do dono. */
function urlDoApp() {
  const u = new URL(urlDono);
  u.username = PAPEL;
  u.password = senhaApp;
  return u.toString();
}

async function aplicarMigrations() {
  await sql`
    create table if not exists _migrations (
      nome        text primary key,
      aplicado_em timestamptz not null default now()
    )
  `;

  const aplicadas = new Set((await sql`select nome from _migrations`).map((r) => r.nome));
  const arquivos = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  let novas = 0;

  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const conteudo = await readFile(path.join(DIR, arquivo), 'utf8');
    console.log(`[migrate] aplicando ${arquivo}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(conteudo);
      await tx`insert into _migrations (nome) values (${arquivo})`;
    });
    novas++;
  }

  console.log(
    novas === 0
      ? `[migrate] nada a fazer — ${arquivos.length} migration(s) ja aplicada(s).`
      : `[migrate] ok — ${novas} migration(s) aplicada(s).`,
  );
}

/**
 * O papel precisa existir ANTES da migration 0002, que so concede privilegios.
 * Idempotente: recria a senha a cada deploy, entao girar APP_DB_PASSWORD e so
 * trocar a variavel e publicar.
 */
async function garantirPapel() {
  const existe = await sql`select 1 from pg_roles where rolname = ${PAPEL}`;
  if (existe.length === 0) {
    await sql.unsafe(
      `create role ${PAPEL} login password ${quote(senhaApp)} nosuperuser nocreatedb nocreaterole nobypassrls`,
    );
    console.log(`[migrate] papel ${PAPEL} criado.`);
  } else {
    await sql.unsafe(`alter role ${PAPEL} password ${quote(senhaApp)} nosuperuser nobypassrls`);
    console.log(`[migrate] papel ${PAPEL} ja existia — senha e atributos reaplicados.`);
  }
}

/** Aspas simples escapadas para literal SQL. Senha nunca entra por interpolacao crua. */
function quote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/**
 * Prova empirica do isolamento, com o papel que a aplicacao usa.
 *
 * Cria duas empresas de teste, le como uma e confere que a outra e invisivel.
 * Limpa tudo no fim, com o dono, mesmo em caso de falha.
 */
async function provarIsolamento() {
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';

  await sql`delete from companies where id in (${A}, ${B})`;
  await sql`
    insert into companies (id, nome) values
      (${A}, 'TESTE ISOLAMENTO A'),
      (${B}, 'TESTE ISOLAMENTO B')
  `;

  const app = postgres(urlDoApp(), { max: 1, prepare: false, onnotice: () => {} });
  const problemas = [];

  try {
    const superusuario = await app`
      select rolsuper, rolbypassrls from pg_roles where rolname = current_user
    `;
    if (superusuario[0]?.rolsuper || superusuario[0]?.rolbypassrls) {
      problemas.push(
        `o papel ${PAPEL} tem superuser/bypassrls — RLS seria ignorada por completo`,
      );
    }

    // Enxergando como a empresa A.
    try {
      const visto = await app.begin(async (tx) => {
        await tx`select set_config('app.company_id', ${A}, true)`;
        return tx`select id, nome from companies where id in (${A}, ${B})`;
      });

      if (visto.length !== 1 || visto[0].id !== A) {
        problemas.push(
          `com app.company_id = A, a consulta devolveu ${visto.length} linha(s) ` +
            `(${visto.map((r) => r.nome).join(', ') || 'nenhuma'}) — deveria devolver exatamente a empresa A`,
        );
      }
    } catch (err) {
      problemas.push(`a consulta com tenant definido levantou erro: ${err.message}`);
    }

    // Sem tenant definido, a politica precisa negar tudo — falha fechada.
    //
    // Esta consulta roda DEPOIS da transacao acima e na mesma conexao, de
    // proposito: e o cenario real de producao, onde a conexao e reciclada entre
    // requisicoes. Foi exatamente aqui que a 0001 quebrou — o parametro nao
    // volta a ser indefinido depois da transacao, volta a ser string vazia.
    try {
      const semTenant = await app`select count(*)::int as n from companies`;
      if (semTenant[0].n !== 0) {
        problemas.push(
          `sem app.company_id definido, a consulta devolveu ${semTenant[0].n} linha(s) — deveria devolver zero`,
        );
      }
    } catch (err) {
      problemas.push(
        `a consulta sem tenant levantou erro em vez de devolver zero linhas: ${err.message}`,
      );
    }
  } finally {
    await app.end({ timeout: 5 }).catch(() => {});
    await sql`delete from companies where id in (${A}, ${B})`;
  }

  if (problemas.length > 0) {
    console.error('\n[isolamento] FALHOU — o multi-tenant NAO esta isolando:');
    for (const p of problemas) console.error(`  - ${p}`);
    console.error(
      '\nPublicar assim significaria uma distribuidora enxergar o faturamento da outra.\n',
    );
    throw new Error('prova de isolamento falhou');
  }

  console.log('[isolamento] ok — tenant so enxerga o proprio dado, e sem tenant nao enxerga nada.');
}

try {
  await sql`select pg_advisory_lock(${LOCK_ID})`;
  await garantirPapel();
  await aplicarMigrations();
  await provarIsolamento();
} catch (err) {
  console.error('[migrate] FALHOU:', err.message);
  process.exitCode = 1;
} finally {
  await sql`select pg_advisory_unlock(${LOCK_ID})`.catch(() => {});
  await sql.end({ timeout: 5 });
}
