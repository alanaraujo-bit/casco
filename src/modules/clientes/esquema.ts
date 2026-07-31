import { z } from 'zod'
import { TIPOS_CLIENTE } from '@/db/schema'
import { documentoValido, soDigitos, telefoneValido, UFS } from '@/lib/formatos'

/**
 * O que vale como cliente.
 *
 * Vive em arquivo próprio, fora das ações, porque o formulário do cliente
 * precisa das mesmas regras para validar antes de enviar. Duas cópias da regra
 * é o jeito garantido de a tela aceitar o que o servidor recusa.
 *
 * **Só o nome é obrigatório.** A tentação é exigir documento e telefone, já que
 * a auditoria achou 4 clientes com telefone em 30 e é um defeito real de
 * cadastro. Mas exigir trava a operadora no balcão com o cliente esperando, e o
 * que ela faz é digitar `000.000.000-00` — trocaríamos um campo vazio, que a
 * tela sabe cobrar, por um campo mentiroso, que ninguém mais questiona. O
 * cabeçalho de métricas é que cobra o cadastro incompleto.
 */

/** Campo de texto opcional: espaço em branco vira `null`, nunca string vazia. */
const textoOpcional = (max = 120) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => v || null)
    .nullable()

export const esquemaCliente = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome do cliente')
    .max(120, 'Máximo de 120 caracteres'),

  tipo: z.enum(TIPOS_CLIENTE, { message: 'Escolha o tipo de cliente' }),

  documento: z
    .string()
    .trim()
    .refine(documentoValido, 'CPF ou CNPJ inválido — confira os números')
    // Guardado só com dígitos: é o que faz o índice único enxergar
    // `123.456.789-09` e `12345678909` como o mesmo cadastro.
    .transform((v) => soDigitos(v) || null)
    .nullable(),

  telefone: z
    .string()
    .trim()
    .refine(telefoneValido, 'Telefone deve ter DDD e 8 ou 9 dígitos')
    .transform((v) => soDigitos(v) || null)
    .nullable(),

  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido')
    .transform((v) => v || null)
    .nullable(),

  cep: z
    .string()
    .trim()
    .refine((v) => v === '' || soDigitos(v).length === 8, 'CEP deve ter 8 dígitos')
    .transform((v) => soDigitos(v) || null)
    .nullable(),

  logradouro: textoOpcional(),
  numero: textoOpcional(20),
  complemento: textoOpcional(60),
  bairro: textoOpcional(60),
  cidade: textoOpcional(60),

  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || (UFS as readonly string[]).includes(v), 'UF inválida')
    .transform((v) => v || null)
    .nullable(),

  /** Onde fica a casa quando não tem número na rua. Vira ouro na montagem de rota. */
  pontoReferencia: textoOpcional(160),

  tabelaPrecoId: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Tabela inválida')
    .transform((v) => v || null)
    .nullable(),

  limiteCredito: z
    .string()
    .trim()
    .transform((v) => (v === '' ? 0 : Number(v.replace(/\./g, '').replace(',', '.'))))
    .refine((v) => Number.isFinite(v) && v >= 0, 'Limite de crédito inválido'),

  observacoes: textoOpcional(500),
})

export type EntradaCliente = z.input<typeof esquemaCliente>
export type ClienteValidado = z.output<typeof esquemaCliente>

/** Campos do formulário, para montar o `FormData` e o estado de erro. */
export const CAMPOS_CLIENTE = [
  'nome',
  'tipo',
  'documento',
  'telefone',
  'email',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'pontoReferencia',
  'tabelaPrecoId',
  'limiteCredito',
  'observacoes',
] as const

export type CampoCliente = (typeof CAMPOS_CLIENTE)[number]

/** Erros por campo + um erro geral que não pertence a campo nenhum. */
export interface EstadoFormularioCliente {
  erro?: string
  campos?: Partial<Record<CampoCliente, string>>
  /**
   * Tudo que foi digitado, devolvido junto com o erro.
   *
   * Não é conveniência: **o React 19 limpa os campos do formulário quando a
   * action termina.** Sem devolver os valores, a operadora preenche dezesseis
   * campos, erra um dígito do CPF e recomeça do zero — no balcão, com o
   * cliente esperando. Foi um teste de fluxo em navegador que pegou isso;
   * `tsc` e `eslint` não têm como ver.
   */
  valores?: Partial<Record<CampoCliente, string>>
  /**
   * Contador de tentativas. Serve de `key` do formulário: só remontando é que
   * os `defaultValue` voltam a ser aplicados depois da limpeza do React.
   */
  tentativa?: number
}

/** Rótulos legíveis, usados no `<select>` e nos selos da tabela. */
export const ROTULO_TIPO: Record<(typeof TIPOS_CLIENTE)[number], string> = {
  revenda: 'Revenda',
  mercado: 'Mercado',
  restaurante: 'Restaurante',
  consumidor: 'Consumidor',
}
