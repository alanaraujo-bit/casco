'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  formatarCep,
  formatarDocumento,
  formatarTelefone,
  mascararCep,
  mascararDocumento,
  mascararTelefone,
  UFS,
} from '@/lib/formatos'
import { ROTULO_TIPO, type EstadoFormularioCliente } from '@/modules/clientes/esquema'
import type { Cliente } from '@/db/schema'

/**
 * Cadastro e edição de cliente, na mesma peça.
 *
 * Duas telas com os mesmos dezesseis campos divergiriam no primeiro ajuste —
 * um campo novo entra no cadastro e some na edição, e ninguém percebe até o
 * cliente reclamar que o complemento sumiu.
 *
 * Campos não controlados, com `defaultValue`, e o `key` do formulário amarrado
 * ao número da tentativa. Esse `key` não é enfeite: **o React 19 limpa os
 * campos quando a action termina**, inclusive quando ela termina em erro. Sem
 * remontar com os valores que a action devolveu, a operadora preenche dezesseis
 * campos, erra um dígito do CPF e recomeça do zero — no balcão, com o cliente
 * esperando. Quem achou isso foi o `npm run fluxo`, num navegador de verdade;
 * `tsc` e `eslint` não têm como ver.
 */

type Props = {
  acao: (
    anterior: EstadoFormularioCliente,
    form: FormData,
  ) => Promise<EstadoFormularioCliente>
  cliente?: Cliente
  tabelas: { id: string; nome: string; padrao: boolean }[]
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-texto-suave">{descricao}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-6">{children}</div>
    </Card>
  )
}

function Campo({
  span = 'sm:col-span-3',
  htmlFor,
  rotulo,
  opcional,
  children,
}: {
  span?: string
  htmlFor: string
  rotulo: string
  opcional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${span}`}>
      <Label htmlFor={htmlFor}>
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>}
      </Label>
      {children}
    </div>
  )
}

function BotaoSalvar({ novo }: { novo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          {novo ? 'Cadastrar cliente' : 'Salvar alterações'}
        </>
      )}
    </Button>
  )
}

export function FormularioCliente({ acao, cliente, tabelas }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioCliente, FormData>(acao, {})
  const novo = !cliente
  const erroDe = (campo: keyof NonNullable<EstadoFormularioCliente['campos']>) =>
    estado.campos?.[campo]

  const padrao = tabelas.find((t) => t.padrao)
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Valor de cada campo: o que a action devolveu vence o que veio do banco.
   * Só assim a correção de um campo não desfaz o que foi digitado nos outros.
   */
  const valor = (campo: keyof NonNullable<EstadoFormularioCliente['valores']>, doBanco = '') =>
    estado.valores?.[campo] ?? doBanco

  // Leva o foco ao primeiro campo com erro depois da remontagem. Sem isto, a
  // pessoa recebe a mensagem e ainda precisa caçar, entre dezesseis campos,
  // qual deles reclamou.
  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  return (
    <form
      // Remonta a cada tentativa, que é o que reaplica os `defaultValue` depois
      // da limpeza automática do React. Ver a nota no topo do arquivo.
      key={estado.tentativa ?? 0}
      ref={formRef}
      action={enviar}
      className="space-y-4"
      noValidate
    >
      {estado.erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <Secao
        titulo="Identificação"
        descricao="Só o nome é obrigatório — o resto pode ser completado depois."
      >
        <Campo span="sm:col-span-4" htmlFor="nome" rotulo="Nome">
          <Input
            id="nome"
            name="nome"
            defaultValue={valor('nome', cliente?.nome ?? '')}
            erro={erroDe('nome')}
            autoFocus={novo}
            autoComplete="off"
            maxLength={120}
            placeholder="Mercado Bom Preço"
          />
        </Campo>

        <Campo span="sm:col-span-2" htmlFor="tipo" rotulo="Tipo">
          <Select
            id="tipo"
            name="tipo"
            defaultValue={valor('tipo', cliente?.tipo ?? 'consumidor')}
            erro={erroDe('tipo')}
          >
            {/* `chave` e não `valor`: `valor` é a função acima, e sombreá-la
                aqui dentro é o tipo de coincidência que sobrevive à revisão e
                explode no dia em que alguém usar as duas na mesma linha. */}
            {Object.entries(ROTULO_TIPO).map(([chave, rotulo]) => (
              <option key={chave} value={chave}>
                {rotulo}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="documento" rotulo="CPF / CNPJ" opcional>
          <Input
            id="documento"
            name="documento"
            defaultValue={valor('documento', formatarDocumento(cliente?.documento))}
            erro={erroDe('documento')}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            onInput={(e) => {
              e.currentTarget.value = mascararDocumento(e.currentTarget.value)
            }}
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="telefone" rotulo="Telefone" opcional>
          <Input
            id="telefone"
            name="telefone"
            defaultValue={valor('telefone', formatarTelefone(cliente?.telefone))}
            erro={erroDe('telefone')}
            inputMode="tel"
            autoComplete="off"
            placeholder="(94) 98100-0000"
            onInput={(e) => {
              e.currentTarget.value = mascararTelefone(e.currentTarget.value)
            }}
          />
        </Campo>

        <Campo span="sm:col-span-6" htmlFor="email" rotulo="E-mail" opcional>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={valor('email', cliente?.email ?? '')}
            erro={erroDe('email')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Campo>
      </Secao>

      <Secao
        titulo="Endereço"
        descricao="Onde a entrega chega. O ponto de referência é o que resolve casa sem número."
      >
        <Campo span="sm:col-span-2" htmlFor="cep" rotulo="CEP" opcional>
          <Input
            id="cep"
            name="cep"
            defaultValue={valor('cep', formatarCep(cliente?.cep))}
            erro={erroDe('cep')}
            inputMode="numeric"
            placeholder="00000-000"
            onInput={(e) => {
              e.currentTarget.value = mascararCep(e.currentTarget.value)
            }}
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="logradouro" rotulo="Rua" opcional>
          <Input
            id="logradouro"
            name="logradouro"
            defaultValue={valor('logradouro', cliente?.logradouro ?? '')}
            erro={erroDe('logradouro')}
          />
        </Campo>

        <Campo span="sm:col-span-1" htmlFor="numero" rotulo="Número" opcional>
          <Input
            id="numero"
            name="numero"
            defaultValue={valor('numero', cliente?.numero ?? '')}
            erro={erroDe('numero')}
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="complemento" rotulo="Complemento" opcional>
          <Input
            id="complemento"
            name="complemento"
            defaultValue={valor('complemento', cliente?.complemento ?? '')}
            erro={erroDe('complemento')}
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="bairro" rotulo="Bairro" opcional>
          <Input
            id="bairro"
            name="bairro"
            defaultValue={valor('bairro', cliente?.bairro ?? '')}
            erro={erroDe('bairro')}
          />
        </Campo>

        <Campo span="sm:col-span-4" htmlFor="cidade" rotulo="Cidade" opcional>
          <Input
            id="cidade"
            name="cidade"
            defaultValue={valor('cidade', cliente?.cidade ?? '')}
            erro={erroDe('cidade')}
          />
        </Campo>

        <Campo span="sm:col-span-2" htmlFor="uf" rotulo="UF" opcional>
          <Select id="uf" name="uf" defaultValue={valor('uf', cliente?.uf ?? '')} erro={erroDe('uf')}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo
          span="sm:col-span-6"
          htmlFor="pontoReferencia"
          rotulo="Ponto de referência"
          opcional
        >
          <Input
            id="pontoReferencia"
            name="pontoReferencia"
            defaultValue={valor('pontoReferencia', cliente?.pontoReferencia ?? '')}
            erro={erroDe('pontoReferencia')}
            placeholder="Em frente à praça, portão azul"
          />
        </Campo>
      </Secao>

      <Secao
        titulo="Comercial"
        descricao="A tabela de preço define quanto este cliente paga pelo mesmo produto."
      >
        <Campo span="sm:col-span-3" htmlFor="tabelaPrecoId" rotulo="Tabela de preço">
          <Select
            id="tabelaPrecoId"
            name="tabelaPrecoId"
            defaultValue={valor('tabelaPrecoId', cliente?.tabelaPrecoId ?? padrao?.id ?? '')}
            erro={erroDe('tabelaPrecoId')}
          >
            <option value="">—</option>
            {tabelas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.padrao ? ' (padrão)' : ''}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="limiteCredito" rotulo="Limite de crédito" opcional>
          <Input
            id="limiteCredito"
            name="limiteCredito"
            defaultValue={valor('limiteCredito', cliente ? Number(cliente.limiteCredito).toFixed(2).replace('.', ',') : '')}
            erro={erroDe('limiteCredito')}
            inputMode="decimal"
            placeholder="0,00"
          />
        </Campo>

        <Campo span="sm:col-span-6" htmlFor="observacoes" rotulo="Observações" opcional>
          <Textarea
            id="observacoes"
            name="observacoes"
            defaultValue={valor('observacoes', cliente?.observacoes ?? '')}
            erro={erroDe('observacoes')}
            maxLength={500}
            placeholder="Só entrega de manhã · portaria não recebe"
          />
        </Campo>
      </Secao>

      {/* Grudento no rodapé: com dezesseis campos, o botão fica fora da tela no
          celular, e a operadora rola até o fim para achar "Salvar" a cada
          cadastro. */}
      <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
        <Button asChild variant="secundario">
          <Link href="/cadastro/clientes">Cancelar</Link>
        </Button>
        <BotaoSalvar novo={novo} />
      </div>
    </form>
  )
}
