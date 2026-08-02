'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SeletorCategoria } from '@/components/ui/seletor-categoria'
import {
  ROTULO_UNIDADE,
  UNIDADES,
  type EstadoFormularioProduto,
} from '@/modules/produtos/esquema'
import type { Produto } from '@/db/schema'

type Props = {
  acao: (
    anterior: EstadoFormularioProduto,
    form: FormData,
  ) => Promise<EstadoFormularioProduto>
  produto?: Produto
  produtosVasilhame: { id: string; nome: string }[]
  /** As categorias já em uso. Alimentam o seletor, que sempre aceita uma nova. */
  categorias: string[]
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
          {novo ? 'Cadastrar produto' : 'Salvar alterações'}
        </>
      )}
    </Button>
  )
}

export function FormularioProduto({ acao, produto, produtosVasilhame, categorias }: Props) {
  const [estado, enviar] = useActionState<EstadoFormularioProduto, FormData>(acao, {})
  const novo = !produto
  const erroDe = (campo: keyof NonNullable<EstadoFormularioProduto['campos']>) =>
    estado.campos?.[campo]

  const formRef = useRef<HTMLFormElement>(null)

  const valor = (campo: keyof NonNullable<EstadoFormularioProduto['valores']>, doBanco = '') =>
    estado.valores?.[campo] ?? doBanco

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  const [retornavelAtual, setRetornavel] = useState(
    valor('retornavel', produto?.retornavel ? 'true' : 'false') === 'true',
  )
  const [controlaEstoqueAtual, setControlaEstoque] = useState(
    valor('controlaEstoque', produto?.controlaEstoque !== false ? 'true' : 'false') === 'true',
  )

  return (
    <form
      key={estado.tentativa ?? 0}
      ref={formRef}
      action={enviar}
      className="space-y-4"
      noValidate
    >
      <AvisoErro erro={estado.erro} />

      <Secao
        titulo="Identificação"
        descricao="Nome e categoria do produto. O código é gerado automaticamente."
      >
        <Campo span="sm:col-span-4" htmlFor="nome" rotulo="Nome">
          <Input
            id="nome"
            name="nome"
            defaultValue={valor('nome', produto?.nome ?? '')}
            erro={erroDe('nome')}
            autoFocus={novo}
            autoComplete="off"
            maxLength={120}
            placeholder="Água 20L Natuclara"
          />
        </Campo>

        <Campo span="sm:col-span-2" htmlFor="sku" rotulo="SKU" opcional>
          <Input
            id="sku"
            name="sku"
            defaultValue={valor('sku', produto?.sku ?? '')}
            erro={erroDe('sku')}
            autoComplete="off"
            maxLength={60}
            placeholder="AGU-20L"
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="categoria" rotulo="Categoria" opcional>
          <SeletorCategoria
            id="categoria"
            categorias={categorias}
            defaultValue={valor('categoria', produto?.categoria ?? '')}
            erro={erroDe('categoria')}
            placeholder="Água mineral"
          />
        </Campo>

        <Campo span="sm:col-span-2" htmlFor="unidade" rotulo="Unidade">
          <Select
            id="unidade"
            name="unidade"
            defaultValue={valor('unidade', produto?.unidade ?? 'un')}
            erro={erroDe('unidade')}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {ROTULO_UNIDADE[u]}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo span="sm:col-span-1" htmlFor="ncm" rotulo="NCM" opcional>
          <Input
            id="ncm"
            name="ncm"
            defaultValue={valor('ncm', produto?.ncm ?? '')}
            erro={erroDe('ncm')}
            inputMode="numeric"
            maxLength={10}
            placeholder="22011000"
          />
        </Campo>
      </Secao>

      <Secao
        titulo="Preço e custo"
        descricao="O preço padrão é usado quando o cliente não tem tabela de preço específica."
      >
        <Campo span="sm:col-span-3" htmlFor="precoPadrao" rotulo="Preço de venda">
          <Input
            id="precoPadrao"
            name="precoPadrao"
            defaultValue={valor(
              'precoPadrao',
              produto ? Number(produto.precoPadrao).toFixed(2).replace('.', ',') : '',
            )}
            erro={erroDe('precoPadrao')}
            inputMode="decimal"
            placeholder="0,00"
          />
        </Campo>

        <Campo span="sm:col-span-3" htmlFor="custo" rotulo="Custo unitário" opcional>
          <Input
            id="custo"
            name="custo"
            defaultValue={valor(
              'custo',
              produto ? Number(produto.custo).toFixed(2).replace('.', ',') : '',
            )}
            erro={erroDe('custo')}
            inputMode="decimal"
            placeholder="0,00"
          />
        </Campo>
      </Secao>

      <Secao
        titulo="Estoque"
        descricao="Defina os limites para ser alertado quando o estoque estiver baixo ou alto demais."
      >
        <Campo span="sm:col-span-2" htmlFor="controlaEstoque" rotulo="Controla estoque?">
          <Select
            id="controlaEstoque"
            name="controlaEstoque"
            defaultValue={valor(
              'controlaEstoque',
              produto?.controlaEstoque !== false ? 'true' : 'false',
            )}
            erro={erroDe('controlaEstoque')}
            onChange={(e) => setControlaEstoque(e.target.value === 'true')}
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </Select>
        </Campo>

        {controlaEstoqueAtual && (
          <>
            <Campo span="sm:col-span-2" htmlFor="estoqueMinimo" rotulo="Estoque mínimo" opcional>
              <Input
                id="estoqueMinimo"
                name="estoqueMinimo"
                defaultValue={valor(
                  'estoqueMinimo',
                  produto ? Number(produto.estoqueMinimo).toString() : '',
                )}
                erro={erroDe('estoqueMinimo')}
                inputMode="decimal"
                placeholder="0"
              />
            </Campo>

            <Campo span="sm:col-span-2" htmlFor="estoqueMaximo" rotulo="Estoque máximo" opcional>
              <Input
                id="estoqueMaximo"
                name="estoqueMaximo"
                defaultValue={valor(
                  'estoqueMaximo',
                  produto ? Number(produto.estoqueMaximo).toString() : '',
                )}
                erro={erroDe('estoqueMaximo')}
                inputMode="decimal"
                placeholder="0"
              />
            </Campo>
          </>
        )}

        {!controlaEstoqueAtual && (
          <>
            <input type="hidden" name="estoqueMinimo" value="0" />
            <input type="hidden" name="estoqueMaximo" value="0" />
          </>
        )}
      </Secao>

      <Secao
        titulo="Vasilhame"
        descricao="Produto que gera comodato — o cliente leva o galão e devolve depois."
      >
        <Campo span="sm:col-span-2" htmlFor="retornavel" rotulo="Retornável?">
          <Select
            id="retornavel"
            name="retornavel"
            defaultValue={valor('retornavel', produto?.retornavel ? 'true' : 'false')}
            erro={erroDe('retornavel')}
            onChange={(e) => setRetornavel(e.target.value === 'true')}
          >
            <option value="false">Não</option>
            <option value="true">Sim</option>
          </Select>
        </Campo>

        {retornavelAtual && (
          <Campo span="sm:col-span-4" htmlFor="vasilhameId" rotulo="Produto do vasilhame" opcional>
            <Select
              id="vasilhameId"
              name="vasilhameId"
              defaultValue={valor('vasilhameId', produto?.vasilhameId ?? '')}
              erro={erroDe('vasilhameId')}
            >
              <option value="">—</option>
              {produtosVasilhame
                .filter((p) => p.id !== produto?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </Select>
          </Campo>
        )}

        {!retornavelAtual && <input type="hidden" name="vasilhameId" value="" />}
      </Secao>

      <div className="sticky bottom-0 -mx-3 flex items-center justify-end gap-2 border-t border-borda bg-fundo/95 px-3 py-3 backdrop-blur md:-mx-5 md:px-5">
        <Button asChild variant="secundario">
          <Link href="/cadastro/produtos">Cancelar</Link>
        </Button>
        <BotaoSalvar novo={novo} />
      </div>
    </form>
  )
}
