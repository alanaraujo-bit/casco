import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL não definida. Veja .env.example.')
}

/**
 * Conexão pensada para Vercel serverless + PgBouncer (transaction mode).
 *
 * `prepare: false` é obrigatório: em transaction mode o PgBouncer devolve a
 * conexão ao pool a cada transação, então prepared statements nomeados somem
 * entre um uso e outro e a query quebra de forma intermitente — o pior tipo
 * de bug, porque só aparece sob concorrência.
 *
 * `max: 1` porque cada invocação serverless é um processo isolado e efêmero:
 * manter um pool interno só desperdiça slots do pool de verdade, que é o
 * PgBouncer.
 */
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client, { schema })

export type Database = typeof db
