-- 0018 — Ícone de referência por produto.
--
-- Não é upload: a chave aponta para um PNG fixo em `public/icones-produto/`
-- (ver `src/modules/produtos/icones.ts`). O conjunto válido de chaves vive
-- na aplicação, não em constraint — é o mesmo tratamento que `categoria` já
-- tem (texto livre validado no zod), e a lista de ícones deve poder crescer
-- sem migration nova.

alter table produtos add column if not exists icone text;

comment on column produtos.icone is
  'Chave da biblioteca fixa de ícones (ver ICONES_PRODUTO em src/modules/produtos/icones.ts). Nula = sem ícone definido.';
