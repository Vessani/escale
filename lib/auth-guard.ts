import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NaoAutorizadoError } from "@/lib/errors"
import { AREA_MOTORISTA, PAPEL_MOTORISTA, PAPEL_TORRE, ehMotorista, ehTorre } from "@/lib/papeis"
import { filialDaTorre } from "@/lib/torre"

/**
 * O motorista (papel MOTORISTA) só passa onde for liberado de propósito
 * (rolesPermitidos com MOTORISTA) — todas as actions, páginas e rotas
 * existentes ficam fechadas pra ele sem precisar mexer em cada uma.
 */
function motoristaBarrado(role: string, rolesPermitidos?: string[]) {
  return ehMotorista(role) && !rolesPermitidos?.includes(PAPEL_MOTORISTA)
}

/**
 * Mesma ideia pra torre: ela só consulta, então fica fora de toda action e
 * página que não a libere de propósito (rolesPermitidos com TORRE) — as
 * actions de escrita que aceitam "qualquer usuário logado" seguem fechadas
 * pra ela sem precisar mexer em cada uma.
 */
function torreBarrada(role: string, rolesPermitidos?: string[]) {
  return ehTorre(role) && !rolesPermitidos?.includes(PAPEL_TORRE)
}

/** Filial da sessão; pra torre (sem filial no cadastro), a que ela escolheu no menu. */
async function filialDaSessao(session: { user: { role: string; filialId: number | null } }) {
  return ehTorre(session.user.role) ? await filialDaTorre() : session.user.filialId
}

/**
 * Reforça a sessão dentro da própria Server Action — o middleware já
 * bloqueia a navegação às páginas sem login, mas uma Action pode ser
 * invocada diretamente (POST), então a checagem não pode depender só dele.
 *
 * Passando `rolesPermitidos`, também exige que `session.user.role` esteja
 * nessa lista (ex: ações admin-only como excluir) — sem isso, qualquer
 * usuário autenticado tem acesso irrestrito à action.
 */
export async function requireSession(rolesPermitidos?: string[]) {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new NaoAutorizadoError()
  }

  if (motoristaBarrado(session.user.role, rolesPermitidos) || torreBarrada(session.user.role, rolesPermitidos)) {
    throw new NaoAutorizadoError()
  }

  if (rolesPermitidos && !rolesPermitidos.includes(session.user.role)) {
    throw new NaoAutorizadoError()
  }

  return session
}

/**
 * Mesma checagem de requireSession, mas pra actions operacionais (viagens/
 * motoristas/frotas/quadro): exige também que a sessão tenha uma filial —
 * SUPERADMIN não tem (gerencia filiais/usuários, não opera dentro de uma) e
 * cairia aqui se tentasse chamar uma action operacional diretamente.
 * Devolve o filialId já resolvido, pra não repetir a checagem de null em
 * cada action.
 */
export async function requireSessionComFilial(rolesPermitidos?: string[]) {
  const session = await requireSession(rolesPermitidos)
  const filialId = await filialDaSessao(session)

  if (filialId === null) {
    throw new NaoAutorizadoError()
  }

  return { session, filialId }
}

type OpcoesPagina = {
  /** Pra onde mandar a torre se a tela não for pra ela (ex: editar viagem → relatório da viagem). */
  destinoDaTorre?: string
}

/**
 * Versão de requireSession pra Server Components (páginas): em vez de lançar,
 * redireciona — sem sessão vai pro login, papel não permitido volta pra home.
 * Defesa em profundidade: o proxy (proxy.ts) já bloqueia a navegação sem
 * login, mas a página não pode depender só dele (uma falha/desvio do proxy
 * exporia os dados que a página carrega no servidor).
 */
export async function requireSessaoPagina(rolesPermitidos?: string[], opcoes: OpcoesPagina = {}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (motoristaBarrado(session.user.role, rolesPermitidos)) {
    redirect(AREA_MOTORISTA)
  }

  // Tela de escrita (nova, editar, importar...): a torre volta pro Dashboard,
  // ou pra versão só leitura da tela, quando houver.
  if (torreBarrada(session.user.role, rolesPermitidos)) {
    redirect(opcoes.destinoDaTorre ?? "/")
  }

  if (rolesPermitidos && !rolesPermitidos.includes(session.user.role)) {
    redirect("/")
  }

  return session
}

/**
 * requireSessaoPagina pras telas operacionais: exige filial. SUPERADMIN (sem
 * filial) é mandado pra área dele, mesmo destino do proxy. A torre usa a
 * filial escolhida no menu.
 */
export async function requireSessaoPaginaComFilial(rolesPermitidos?: string[], opcoes: OpcoesPagina = {}) {
  const session = await requireSessaoPagina(rolesPermitidos, opcoes)
  const filialId = await filialDaSessao(session)

  if (filialId === null) {
    // Torre sem nenhuma filial cadastrada ainda: não há o que mostrar (e
    // redirecionar pra qualquer tela só daria volta) — cai na tela de erro.
    if (ehTorre(session.user.role)) throw new Error("Nenhuma filial cadastrada.")
    redirect("/admin/filiais")
  }

  return { session, filialId }
}

/**
 * Actions do motorista (área "Minhas viagens"): exige o papel MOTORISTA e
 * devolve o motorista dono do acesso — toda consulta da área filtra por ele.
 */
export async function requireSessaoMotorista() {
  const session = await requireSession([PAPEL_MOTORISTA])
  const motoristaId = session.user.motoristaId
  if (!motoristaId || session.user.filialId === null) {
    throw new NaoAutorizadoError()
  }
  return { session, filialId: session.user.filialId, motoristaId }
}

/** Páginas da área do motorista: mesmo que requireSessaoMotorista, redirecionando em vez de lançar. */
export async function requireSessaoPaginaMotorista() {
  const session = await requireSessaoPagina([PAPEL_MOTORISTA])
  const motoristaId = session.user.motoristaId
  if (!motoristaId || session.user.filialId === null) {
    redirect("/login")
  }
  return { session, filialId: session.user.filialId, motoristaId }
}
