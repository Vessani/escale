import type { MotoristaCompativel } from "@/lib/types/alocacao"

/** Texto padrão de um motorista compatível pra opção de `<Select>` — usado onde não dá pra ter layout rico (avatar/linhas). */
export function formatarOpcaoMotoristaCompativel(motorista: MotoristaCompativel): string {
  const partes = [motorista.nome, `${motorista.diasDisponiveis}d disponível`]

  if (motorista.horarioHabitual) {
    partes.push(`jornada ${motorista.horarioHabitual}`)
  }

  return partes.join(" · ")
}
