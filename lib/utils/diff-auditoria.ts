/**
 * Diff genérico e raso entre dois snapshots JSON (antes/depois de um
 * RegistroAuditoria) — um só algoritmo pra qualquer entidade, sem lógica
 * por-model: pega a união das chaves de ambos os lados, e reporta as que
 * mudaram (comparação por JSON.stringify, cobre arrays/objetos aninhados
 * como um valor só). Usado tanto no painel "Histórico" de um registro
 * quanto no feed /historico.
 */

const CAMPOS_IGNORADOS = new Set(["id", "criadoEm", "atualizadoEm"])

export type CampoAlterado = {
  campo: string
  valorAntigo: unknown
  valorNovo: unknown
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "—"
  if (typeof valor === "object") return JSON.stringify(valor)
  return String(valor)
}

export function diffAuditoria(
  antes: Record<string, unknown> | null | undefined,
  depois: Record<string, unknown> | null | undefined,
): CampoAlterado[] {
  const chaves = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])
  const alteracoes: CampoAlterado[] = []

  for (const campo of chaves) {
    if (CAMPOS_IGNORADOS.has(campo)) continue

    const valorAntigo = antes?.[campo]
    const valorNovo = depois?.[campo]
    if (JSON.stringify(valorAntigo) === JSON.stringify(valorNovo)) continue

    alteracoes.push({ campo, valorAntigo, valorNovo })
  }

  return alteracoes
}

export function formatarCampoAlterado(alteracao: CampoAlterado): string {
  return `${alteracao.campo}: ${formatarValor(alteracao.valorAntigo)} → ${formatarValor(alteracao.valorNovo)}`
}
