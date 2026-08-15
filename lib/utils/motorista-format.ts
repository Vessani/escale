import type { MotoristaCompativel } from "@/lib/types/alocacao"

/**
 * "X dia(s) disponível(is) · livre a partir de HH:MM" — sem o nome, pra usar
 * onde ele já aparece em outro lugar (ex: fechado no `<SelectValue>`, ao lado
 * da carta de sugestão automática). Mostra `proximoInicioDisponivel` (quando
 * ele pode legalmente começar, respeitando o descanso), não `horarioHabitual`
 * (só o horário do último turno importado) — é o primeiro que decide a ordem
 * de sugestão (ver `filtrarMotoristasCompativeis` em alocacao.service.ts);
 * mostrar o segundo aqui confundia, porque os dois números não têm relação
 * direta entre si.
 */
export function formatarDetalheMotoristaCompativel(motorista: MotoristaCompativel): string {
  const dias = motorista.diasDisponiveis === 1 ? "1 dia disponível" : `${motorista.diasDisponiveis} dias disponíveis`
  const partes = [dias]

  if (motorista.proximoInicioDisponivel) {
    partes.push(`livre a partir de ${motorista.proximoInicioDisponivel}`)
  }

  return partes.join(" · ")
}

/** Texto padrão de um motorista compatível pra opção de `<Select>` — usado onde não dá pra ter layout rico (avatar/linhas) e o nome ainda não apareceu em nenhum outro lugar da tela. */
export function formatarOpcaoMotoristaCompativel(motorista: MotoristaCompativel): string {
  return `${motorista.nome} · ${formatarDetalheMotoristaCompativel(motorista)}`
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
