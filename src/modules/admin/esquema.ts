import { z } from 'zod'

/**
 * O que vale como acesso de distribuidora, visto do painel da Aionix.
 *
 * Mesma divisão dos outros cadastros: o esquema mora em arquivo próprio para
 * que o formulário e a action validem pela mesma regra, e não por duas cópias
 * que divergem no primeiro ajuste.
 */

export const PAPEIS = ['dono', 'operador', 'entregador'] as const
export type PapelAcesso = (typeof PAPEIS)[number]

/**
 * O rótulo e a frase que aparecem no seletor.
 *
 * A frase existe porque "operador" e "entregador" não se explicam sozinhos para
 * quem está criando o acesso às pressas, e escolher errado aqui é dar o
 * faturamento da distribuidora para quem só devia dar baixa em entrega. O
 * espelho disto no banco é o `check (papel in (...))` da migration 0001.
 */
export const DESCRICAO_PAPEL: Record<PapelAcesso, { rotulo: string; resumo: string }> = {
  dono: { rotulo: 'Dono', resumo: 'Vê tudo, inclusive financeiro e relatórios.' },
  operador: { rotulo: 'Operador', resumo: 'Balcão: vendas, clientes e vasilhame.' },
  entregador: { rotulo: 'Entregador', resumo: 'Entregas e retorno de vasilhame.' },
}

/**
 * Oito caracteres, como no `empresa:criar`, e não os dez exigidos do admin da
 * Aionix. A diferença é de alcance: a senha do admin abre todas as
 * distribuidoras, esta abre uma. Sem regra de composição, pelo motivo anotado
 * em `modules/admin/acoes.ts` — exigir símbolo produz `Senha@123`.
 */
const senha = z.string().min(8, 'Use pelo menos 8 caracteres')

export const esquemaAcesso = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da pessoa').max(120, 'Máximo de 120 caracteres'),

  // `lower` aqui e no banco: e-mail digitado com maiúscula no cadastro e sem
  // maiúscula no login é o chamado de suporte mais bobo que existe.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail')
    .max(160, 'Máximo de 160 caracteres')
    .email('E-mail inválido'),

  senha,

  papel: z.enum(PAPEIS, { message: 'Escolha o nível de acesso' }),
})

export const esquemaNovaSenha = z.object({
  usuarioId: z.string().uuid('Usuário inválido'),
  senha,
})

export const CAMPOS_ACESSO = ['nome', 'email', 'senha', 'papel'] as const
export type CampoAcesso = (typeof CAMPOS_ACESSO)[number]

/**
 * Note que `valores` não guarda a senha.
 *
 * O `AGENTS.md` manda devolver o que foi digitado quando a action falha, porque
 * o React 19 limpa o formulário e a pessoa perde a ficha inteira. Campo de
 * senha é a exceção, pelo mesmo motivo da tela de troca do admin: devolvê-lo
 * significa mandar a senha em texto claro de volta e deixá-la no HTML. Nome,
 * e-mail e papel voltam; a senha é redigitada.
 */
export interface EstadoAcesso {
  erro?: string
  ok?: string
  campos?: Partial<Record<CampoAcesso, string>>
  valores?: Partial<Record<Exclude<CampoAcesso, 'senha'>, string>>
  tentativa?: number
}

// ---------------------------------------------------------- config da plataforma

/**
 * O webhook do Discord onde o feedback (`src/lib/discord.ts`) é avisado.
 *
 * Campo vazio é válido e tem significado: limpa a configuração, e o aviso para
 * de sair — o relato continua gravado no banco, só o alerta some. Por isso o
 * esquema aceita string vazia, e só valida o formato quando há algo digitado.
 */
export const esquemaConfig = z.object({
  discordWebhookFeedback: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/.+/.test(v),
      'Cole a URL completa do webhook do Discord (começa com https://discord.com/api/webhooks/)',
    )
    .transform((v) => v || null)
    .nullable(),
})

export interface EstadoConfig {
  erro?: string
  ok?: string
  campo?: string
  valor?: string
  tentativa?: number
}
