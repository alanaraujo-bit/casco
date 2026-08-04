'use client'

import Link from 'next/link'
import { PhoneOff, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BotaoExcluirCadastro } from '@/components/ui/botao-excluir-cadastro'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDocumento, formatarTelefone } from '@/lib/formatos'
import { alternarAtivoCliente } from '@/modules/clientes/acoes'
import { ROTULO_TIPO } from '@/modules/clientes/esquema'
import type { ClienteLista } from '@/modules/clientes/consultas'

/** Iniciais em bolinha colorida — o cartão de cliente é a melhor tela deles. */
function Avatar({ nome }: { nome: string }) {
  const iniciais = nome
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  // Cor derivada do nome: estável entre sessões e sem precisar guardar nada.
  const indice = [...nome].reduce((s, c) => s + c.charCodeAt(0), 0) % 6
  return (
    <span
      className="grid size-7 shrink-0 place-items-center rounded-full text-2xs font-semibold"
      // Fundo tênue + tinta forte, não branco sobre a cor cheia: branco sobre
      // as categóricas dá de 2,8:1 a 3,8:1, e a inicial em 12px semibold fica
      // ilegível justamente na cor mais clara.
      style={{
        background: `color-mix(in oklch, var(--cat-${indice + 1}) 18%, transparent)`,
        color: `var(--cat-${indice + 1}-forte)`,
      }}
      aria-hidden
    >
      {iniciais || '?'}
    </span>
  )
}

const TOM_TIPO = {
  revenda: 'acento',
  mercado: 'info',
  restaurante: 'alerta',
  consumidor: 'neutro',
} as const

const colunas: Coluna<ClienteLista>[] = [
  {
    chave: 'codigo',
    cabecalho: 'Código',
    // `0002 - DANIEL` é como eles leem o cliente hoje, e vão continuar lendo.
    texto: (c) => (c.codigo ? String(c.codigo).padStart(4, '0') : '—'),
    valor: (c) => c.codigo ?? 0,
    numerica: true,
    larguraMin: '5rem',
  },
  {
    chave: 'nome',
    cabecalho: 'Cliente',
    texto: (c) => c.nome,
    celula: (c) => (
      <span className="flex items-center gap-2">
        <Avatar nome={c.nome} />
        <span className="truncate">{c.nome}</span>
      </span>
    ),
    fixa: true,
    larguraMin: '15rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'tipo',
    cabecalho: 'Tipo',
    texto: (c) => ROTULO_TIPO[c.tipo as keyof typeof ROTULO_TIPO] ?? c.tipo,
    celula: (c) => (
      <Badge variant={TOM_TIPO[c.tipo as keyof typeof TOM_TIPO] ?? 'neutro'}>
        {ROTULO_TIPO[c.tipo as keyof typeof ROTULO_TIPO] ?? c.tipo}
      </Badge>
    ),
  },
  {
    chave: 'documento',
    cabecalho: 'CPF / CNPJ',
    // Formatado só aqui: no banco vive sem pontuação, para o índice único
    // enxergar `123.456.789-09` e `12345678909` como o mesmo cadastro.
    texto: (c) => (c.documento ? formatarDocumento(c.documento) : '—'),
    celula: (c) =>
      c.documento ? (
        formatarDocumento(c.documento)
      ) : (
        <span className="text-texto-fraco">não informado</span>
      ),
  },
  {
    chave: 'telefone',
    cabecalho: 'Telefone',
    texto: (c) => (c.telefone ? formatarTelefone(c.telefone) : '—'),
    // Cliente sem telefone não é detalhe de cadastro: é cliente que a empresa
    // não consegue cobrar nem avisar de entrega. A auditoria achou 4 com
    // telefone em 30. Marcar em vermelho é o que torna o problema visível.
    celula: (c) =>
      c.telefone ? (
        formatarTelefone(c.telefone)
      ) : (
        <span className="inline-flex items-center gap-1 text-perigo">
          <PhoneOff className="size-3.5" aria-hidden />
          sem telefone
        </span>
      ),
  },
  { chave: 'bairro', cabecalho: 'Bairro', texto: (c) => c.bairro || '—' },
  { chave: 'cidade', cabecalho: 'Cidade', texto: (c) => c.cidade || '—' },
  {
    chave: 'vasilhames',
    cabecalho: 'Vasilhames',
    texto: (c) => String(c.vasilhames),
    valor: (c) => c.vasilhames,
    numerica: true,
    celula: (c) =>
      c.vasilhames > 0 ? (
        <span
          className={c.vasilhames > 30 ? 'font-medium text-alerta' : undefined}
          title={c.vasilhames > 30 ? 'Muitos galões em poder deste cliente' : undefined}
        >
          {c.vasilhames}
        </span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
  {
    chave: 'acoes',
    cabecalho: 'Ações',
    texto: () => '',
    celula: (c) => (
      <BotaoExcluirCadastro aoExcluir={() => alternarAtivoCliente(c.id, false)} />
    ),
    ordenavel: false,
    alinhamento: 'direita',
    larguraMin: '8rem',
  },
]

export function TabelaClientes({ linhas }: { linhas: ClienteLista[] }) {
  return (
    <TabelaDados
      id="clientes"
      legenda="Clientes cadastrados"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(c) => c.id}
      linkDaLinha={(c) => `/cadastro/clientes/${c.id}`}
      buscaPlaceholder="Buscar por nome, documento, bairro…"
      nomeExportacao="clientes"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/cadastro/clientes/novo">
            <UserPlus aria-hidden />
            Novo cliente
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum cliente cadastrado',
        descricao:
          'Cadastre o primeiro cliente para começar a lançar vendas e controlar vasilhame.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/cadastro/clientes/novo">
              <UserPlus aria-hidden />
              Cadastrar primeiro cliente
            </Link>
          </Button>
        ),
      }}
    />
  )
}
