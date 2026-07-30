import { redirect } from 'next/navigation'

/**
 * A raiz não tem tela própria.
 *
 * Havia aqui uma landing com "Entrar no sistema" e "Design system". Ela fazia
 * sentido enquanto o projeto era uma vitrine sem login; agora é uma parada a
 * mais entre a pessoa e o trabalho — e expunha uma ferramenta nossa a quem
 * abrisse o endereço. Quem não tem sessão o `proxy.ts` já manda para o login;
 * quem tem, quer o painel.
 */
export default function Home() {
  redirect('/painel')
}
