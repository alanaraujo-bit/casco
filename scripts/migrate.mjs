/**
 * Runner de migrations.
 *
 * Roda no build da Vercel (ver script `db:migrate` no package.json), porque
 * este projeto nao executa nada na maquina local.
 *
 * Regras:
 *  - Aplica os arquivos de ./migrations em ordem alfabetica.
 *  - Cada arquivo roda dentro de uma transacao: ou aplica inteiro, ou nada.
 *  - O que ja foi aplicado fica registrado em `_migrations` e nao repete.
 *  - Usa DIRECT_DATABASE_URL (conexao direta, porta 5432). DDL nao funciona
 *    de forma confiavel atraves do PgBouncer em transaction mode.
 *  - Um advisory lock impede que dois builds simultaneos migrem ao mesmo tempo.
 */
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const LOCK_ID = 947_233_11; // arbitrario, so precisa ser estavel entre deploys

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DIRECT_DATABASE_URL (ou DATABASE_URL) nao definida.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`select pg_advisory_lock(${LOCK_ID})`;

  await sql`
    create table if not exists _migrations (
      nome        text primary key,
      aplicado_em timestamptz not null default now()
    )
  `;

  const aplicadas = new Set(
    (await sql`select nome from _migrations`).map((r) => r.nome),
  );

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
} catch (err) {
  console.error('[migrate] FALHOU:', err.message);
  process.exitCode = 1;
} finally {
  await sql`select pg_advisory_unlock(${LOCK_ID})`.catch(() => {});
  await sql.end({ timeout: 5 });
}
