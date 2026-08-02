/**
 * Provisiona uma distribuidora no Casco.
 *
 * Não é seed de demonstração: é a ferramenta de abrir cliente novo. Cria a
 * empresa, o usuário dono, e os cadastros mínimos sem os quais o sistema não
 * opera no primeiro dia — tabelas de preço, formas de pagamento e o caixa da
 * loja. Distribuidora que entra e encontra o combo de forma de pagamento vazio
 * não consegue registrar a primeira venda.
 *
 *     npm run empresa:criar -- --nome "JM Distribuidora Natuclara" \
 *                              --email dono@jm.com.br --senha "..."
 *
 * Idempotente pelo e-mail: rodar de novo com o mesmo e-mail atualiza a senha em
 * vez de duplicar a empresa.
 *
 * Roda como dono do banco (DIRECT_DATABASE_URL) porque cria a linha em
 * `companies`, que é a única tabela sem tenant anterior a que se apoiar.
 */
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { uuidv7 } from 'uuidv7'

const args = process.argv.slice(2)
const arg = (nome) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : undefined
}

const nomeEmpresa = arg('nome')
const email = arg('email')?.trim().toLowerCase()
const senha = arg('senha')
const nomeUsuario = arg('usuario') ?? 'Administrador'
const documento = arg('documento') ?? null

if (!nomeEmpresa || !email || !senha) {
  console.error(
    'Uso: npm run empresa:criar -- --nome "Distribuidora X" --email dono@x.com --senha "..."\n' +
      '     opcionais: --usuario "Nome" --documento "00.000.000/0001-00"',
  )
  process.exit(1)
}
if (senha.length < 8) {
  console.error('A senha precisa de pelo menos 8 caracteres.')
  process.exit(1)
}

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('DIRECT_DATABASE_URL não definida. Veja .env.example.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice() {} })

/** Custo 12: ~250ms por verificação. Login não é rota quente, e senha de ERP
 *  financeiro não deve ser barata de testar em massa se o banco vazar. */
const CUSTO_BCRYPT = 12

try {
  const existente = await sql`
    select u.id, u.company_id, c.nome as empresa
      from users u join companies c on c.id = u.company_id
     where lower(u.email) = ${email}
  `

  if (existente.length > 0) {
    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT)
    await sql`update users set senha_hash = ${hash}, ativo = true where id = ${existente[0].id}`
    console.log(`Usuário já existia em "${existente[0].empresa}" — senha redefinida.`)
    console.log(`  E-mail: ${email}`)
    process.exit(0)
  }

  const companyId = uuidv7()
  const usuarioId = uuidv7()
  const hash = await bcrypt.hash(senha, CUSTO_BCRYPT)

  await sql.begin(async (tx) => {
    await tx`
      insert into companies (id, nome, documento)
           values (${companyId}, ${nomeEmpresa}, ${documento})
    `
    await tx`
      insert into users (id, company_id, nome, email, senha_hash, papel)
           values (${usuarioId}, ${companyId}, ${nomeUsuario}, ${email}, ${hash}, 'dono')
    `

    // As três tabelas de preço que o negócio exige: revenda, mercadinho e
    // consumidor final pagam diferente pelo mesmo galão. A do consumidor é a
    // padrão porque é a venda de balcão, a mais frequente.
    for (const [nome, padrao] of [
      ['Consumidor Final', true],
      ['Mercadinho', false],
      ['Revenda', false],
    ]) {
      await tx`
        insert into tabelas_preco (id, company_id, nome, padrao)
             values (${uuidv7()}, ${companyId}, ${nome}, ${padrao})
      `
    }

    const caixaId = uuidv7()
    await tx`
      insert into contas_bancarias (id, company_id, nome, tipo)
           values (${caixaId}, ${companyId}, 'Caixa Loja', 'caixa')
    `

    // A taxa do cartão entra já preenchida. Sem ela, o dono acha que recebeu o
    // valor cheio até conciliar o extrato no fim do mês.
    for (const [nome, tipo, taxa, prazo] of [
      ['Dinheiro', 'dinheiro', 0, 0],
      ['PIX', 'pix', 0, 0],
      ['Cartão Débito', 'debito', 1.49, 1],
      ['Cartão Crédito', 'credito', 3.19, 30],
      ['A Prazo', 'a_prazo', 0, 30],
    ]) {
      await tx`
        insert into formas_pagamento (id, company_id, nome, tipo, taxa_percentual, prazo_dias, conta_id)
             values (${uuidv7()}, ${companyId}, ${nome}, ${tipo}, ${taxa}, ${prazo}, ${caixaId})
      `
    }
  })

  console.log(`Empresa "${nomeEmpresa}" criada.`)
  console.log(`  E-mail: ${email}`)
  console.log(`  Papel:  dono`)
  console.log('\n  Criados junto: 3 tabelas de preço, 5 formas de pagamento, Caixa Loja.')
} catch (err) {
  console.error('FALHOU:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
