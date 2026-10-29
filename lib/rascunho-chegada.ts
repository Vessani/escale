import { entregaMudouDesdeAVista, type EntregaVista } from "@/lib/services/trava-chegada"

/**
 * Rascunho da chegada no cliente, guardado no próprio celular (localStorage)
 * enquanto o motorista preenche. O navegador do celular costuma descarregar
 * a aba quando ele vai pro WhatsApp, câmera ou GPS — ao voltar, a página
 * recarrega e o que não foi registrado sumia. Com o rascunho, o formulário
 * volta aberto e preenchido.
 *
 * Só protege o que foi digitado: nada vai pro sistema até o motorista tocar
 * em "Registrar chegada", e o servidor confere tudo como sempre. O rascunho
 * é do motorista logado (a chave leva o id dele e o da viagem), some ao
 * registrar ou cancelar, e vence em VALIDADE_RASCUNHO_HORAS.
 */

export const VALIDADE_RASCUNHO_HORAS = 24
const VERSAO = 1
const PREFIXO = "escalador:rascunho-chegada"

/** Os campos do formulário, como texto (do jeito que estão na tela). */
export type CamposRascunho = {
  km: string
  quando: string
  medicao: "MANOMETRO" | "BALANCA" | null
  fator: string
  polInicial: string
  polFinal: string
  m3Inicial: string
  m3Final: string
  kgInicial: string
  kgFinal: string
  pctInicial: string
  pctFinal: string
  inicial: string
  final: string
}

export type RascunhoChegada = {
  versao: typeof VERSAO
  salvoEm: number
  /** O cliente que o motorista estava vendo quando abriu (ver EntradaEntregaVista). */
  vista: EntregaVista & { id: number }
  campos: CamposRascunho
}

/** O mínimo de Storage que o rascunho usa — o localStorage, ou um falso nos testes. */
type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function chaveDoRascunho(chaveViagem: string, entregaId: number): string {
  return `${PREFIXO}:${chaveViagem}:e${entregaId}`
}

/** Algum campo de leitura preenchido — rascunho só com a data e hora padrão não vale guardar. */
export function rascunhoTemConteudo(campos: CamposRascunho): boolean {
  // A data e hora vêm preenchidas sozinhas: não contam como "digitou algo".
  const { medicao, ...texto } = campos
  return medicao !== null || Object.entries(texto).some(([campo, valor]) => campo !== "quando" && valor.trim() !== "")
}

/**
 * O localStorage pode não existir ou lançar (aba anônima, armazenamento
 * cheio ou bloqueado): o rascunho é um extra — se falhar, a tela segue
 * funcionando como antes.
 */
function armazenamentoPadrao(): Armazenamento | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function salvarRascunho(
  chave: string,
  vista: RascunhoChegada["vista"],
  campos: CamposRascunho,
  { agora = Date.now(), armazenamento = armazenamentoPadrao() }: { agora?: number; armazenamento?: Armazenamento | null } = {},
) {
  if (!armazenamento) return
  try {
    if (!rascunhoTemConteudo(campos)) {
      armazenamento.removeItem(chave)
      return
    }
    const rascunho: RascunhoChegada = { versao: VERSAO, salvoEm: agora, vista, campos }
    armazenamento.setItem(chave, JSON.stringify(rascunho))
  } catch {
    // Sem espaço ou bloqueado: segue sem rascunho.
  }
}

export function apagarRascunho(chave: string, armazenamento: Armazenamento | null = armazenamentoPadrao()) {
  try {
    armazenamento?.removeItem(chave)
  } catch {
    // idem
  }
}

/**
 * O rascunho dessa entrega, se ainda vale. Descarta (e apaga) o que venceu,
 * o que está num formato antigo/estragado e o de uma entrega que mudou de
 * cliente desde então — a medição foi feita no cliente de antes, então não
 * pode reaparecer em outro.
 */
export function lerRascunho(
  chave: string,
  entregaAtual: EntregaVista & { id: number },
  { agora = Date.now(), armazenamento = armazenamentoPadrao() }: { agora?: number; armazenamento?: Armazenamento | null } = {},
): RascunhoChegada | null {
  if (!armazenamento) return null
  let texto: string | null
  try {
    texto = armazenamento.getItem(chave)
  } catch {
    return null
  }
  if (!texto) return null

  const rascunho = interpretar(texto)
  const valido =
    rascunho !== null &&
    agora - rascunho.salvoEm <= VALIDADE_RASCUNHO_HORAS * 60 * 60 * 1000 &&
    rascunho.vista.id === entregaAtual.id &&
    !entregaMudouDesdeAVista(entregaAtual, rascunho.vista)
  if (!valido) {
    apagarRascunho(chave, armazenamento)
    return null
  }
  return rascunho
}

const CAMPOS_TEXTO = [
  "km",
  "quando",
  "fator",
  "polInicial",
  "polFinal",
  "m3Inicial",
  "m3Final",
  "kgInicial",
  "kgFinal",
  "pctInicial",
  "pctFinal",
  "inicial",
  "final",
] as const

function interpretar(texto: string): RascunhoChegada | null {
  try {
    const dado = JSON.parse(texto) as Partial<RascunhoChegada>
    const campos = dado.campos as Record<string, unknown> | undefined
    const vista = dado.vista as Record<string, unknown> | undefined
    if (dado.versao !== VERSAO || typeof dado.salvoEm !== "number" || !campos || !vista) return null
    if (typeof vista.id !== "number" || !["cliente", "cidade", "uf"].every((k) => typeof vista[k] === "string")) return null
    if (!CAMPOS_TEXTO.every((k) => typeof campos[k] === "string")) return null
    if (campos.medicao !== null && campos.medicao !== "MANOMETRO" && campos.medicao !== "BALANCA") return null
    return dado as RascunhoChegada
  } catch {
    return null
  }
}

const SEM_RASCUNHOS: ReadonlyMap<number, RascunhoChegada> = new Map()

/**
 * Leitura única, ao abrir a tela, dos rascunhos das entregas ainda sem
 * chegada (as que já têm chegada perdem o rascunho que sobrou). Feita pra
 * useSyncExternalStore: `ler` devolve sempre o mesmo Map depois da primeira
 * leitura, e `noServidor` é vazio — sem diferença na hidratação e sem
 * setState dentro de effect.
 */
export function criarLeitorRascunhos(
  chaveViagem: string | undefined,
  entregas: ReadonlyArray<EntregaVista & { id: number; chegada: unknown }>,
) {
  let lidos: ReadonlyMap<number, RascunhoChegada> | null = null
  return {
    ler(): ReadonlyMap<number, RascunhoChegada> {
      if (lidos) return lidos
      if (!chaveViagem) return (lidos = SEM_RASCUNHOS)
      const achados = new Map<number, RascunhoChegada>()
      for (const entrega of entregas) {
        const chave = chaveDoRascunho(chaveViagem, entrega.id)
        if (entrega.chegada) {
          apagarRascunho(chave)
          continue
        }
        const rascunho = lerRascunho(chave, entrega)
        if (rascunho) achados.set(entrega.id, rascunho)
      }
      return (lidos = achados.size > 0 ? achados : SEM_RASCUNHOS)
    },
    noServidor: (): ReadonlyMap<number, RascunhoChegada> => SEM_RASCUNHOS,
  }
}
