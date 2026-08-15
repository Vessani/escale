import type { MotoristaCompativel } from "@/lib/types/alocacao"

/**
 * Texto padrão de um motorista compatível pra opção de `<Select>` — usado
 * onde não dá pra ter layout rico (avatar/linhas). Mostra
 * `proximoInicioDisponivel` (quando ele pode legalmente começar, respeitando
 * o descanso), não `horarioHabitual` (só o horário do último turno
 * importado) — é o primeiro que decide a ordem de sugestão (ver
 * `filtrarMotoristasCompativeis` em alocacao.service.ts); mostrar o segundo
 * aqui confundia, porque os dois números não têm relação direta entre si.
 */
export function formatarOpcaoMotoristaCompativel(motorista: MotoristaCompativel): string {
  const dias = motorista.diasDisponiveis === 1 ? "1 dia disponível" : `${motorista.diasDisponiveis} dias disponíveis`
  const partes = [motorista.nome, dias]

  if (motorista.proximoInicioDisponivel) {
    partes.push(`livre a partir de ${motorista.proximoInicioDisponivel}`)
  }

  return partes.join(" · ")
}

/** Rótulo padrão de uma opção de motorista principal, cruzando compatibilidade (regra de negócio) com disponibilidade (agenda/descanso). */
export function rotularMotoristaParaSelect(compativel: boolean, disponivel: boolean): string {
  if (disponivel) {
    return compativel ? "(Compatível)" : "(Emergência)"
  }
  return compativel
    ? "(Sem descanso / já em viagem)"
    : "(Emergência + sem descanso)"
}
