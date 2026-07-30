'use client'

import * as React from 'react'
import { PhoneOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { CLIENTES, type ClienteDemo } from '@/lib/demo'
import { moeda } from '@/lib/utils'

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
  Revenda: 'acento',
  Mercado: 'info',
  Restaurante: 'alerta',
  Consumidor: 'neutro',
} as const

const colunas: Coluna<ClienteDemo>[] = [
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
    texto: (c) => c.tipo,
    celula: (c) => <Badge variant={TOM_TIPO[c.tipo]}>{c.tipo}</Badge>,
  },
  {
    chave: 'documento',
    cabecalho: 'CPF / CNPJ',
    texto: (c) => c.documento || '—',
    celula: (c) =>
      c.documento || <span className="text-texto-fraco">não informado</span>,
  },
  {
    chave: 'telefone',
    cabecalho: 'Telefone',
    texto: (c) => c.telefone || '—',
    // Cliente sem telefone não é detalhe de cadastro: é cliente que a empresa
    // não consegue cobrar nem avisar de entrega. A auditoria achou 4 com
    // telefone em 30. Marcar em vermelho é o que torna o problema visível.
    celula: (c) =>
      c.telefone || (
        <span className="inline-flex items-center gap-1 text-perigo">
          <PhoneOff className="size-3.5" aria-hidden />
          sem telefone
        </span>
      ),
  },
  { chave: 'bairro', cabecalho: 'Bairro', texto: (c) => c.bairro },
  { chave: 'cidade', cabecalho: 'Cidade', texto: (c) => c.cidade },
  {
    chave: 'vasilhames',
    cabecalho: 'Vasilhames',
    texto: (c) => String(c.vasilhames),
    valor: (c) => c.vasilhames,
    numerica: true,
    celula: (c) => (
      <span
        className={c.vasilhames > 30 ? 'font-medium text-alerta' : undefined}
        title={c.vasilhames > 30 ? 'Muitos galões em poder deste cliente' : undefined}
      >
        {c.vasilhames}
      </span>
    ),
  },
  {
    chave: 'ultimaCompra',
    cabecalho: 'Última compra',
    texto: (c) => c.ultimaCompra,
    // Ordena pelos dias parados, não pelo texto: dd/mm/aaaa comparado como
    // texto ordena por dia do mês.
    valor: (c) => -c.diasSemComprar,
    celula: (c) => (
      <span className="whitespace-nowrap">
        {c.ultimaCompra}
        {c.diasSemComprar >= 15 && (
          <span className="ml-1.5 text-alerta">· {c.diasSemComprar} dias</span>
        )}
      </span>
    ),
  },
  {
    chave: 'saldoDevedor',
    cabecalho: 'Saldo devedor',
    texto: (c) => moeda(c.saldoDevedor),
    valor: (c) => c.saldoDevedor,
    numerica: true,
    papelMobile: 'destaque',
    celula: (c) =>
      c.saldoDevedor > 0 ? (
        <span className="font-medium text-texto">{moeda(c.saldoDevedor)}</span>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
]

export function TabelaClientes() {
  return (
    <TabelaDados
      id="clientes"
      legenda="Clientes cadastrados"
      colunas={colunas}
      linhas={CLIENTES}
      chaveLinha={(c) => c.id}
      buscaPlaceholder="Buscar por nome, documento, bairro…"
      nomeExportacao="clientes"
      vazio={{
        descricao:
          'Cadastre o primeiro cliente para começar a lançar vendas e controlar vasilhame.',
      }}
    />
  )
}
