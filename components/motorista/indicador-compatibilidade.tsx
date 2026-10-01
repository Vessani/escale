import { cn } from "@/lib/utils"

/**
 * Situação de um motorista pra uma viagem, cruzando as duas perguntas que a
 * escolha manual faz: "cabe na regra?" (turno, dias, produto, integração —
 * motoristaEhCompativel) e "está livre?" (agenda e descanso —
 * motoristaEstaDisponivelNoPeriodo).
 */
export type SituacaoMotorista = "OK" | "SEM_DESCANSO" | "FORA_DA_REGRA" | "FORA_DA_REGRA_SEM_DESCANSO"

export function situacaoDoMotorista(compativel: boolean, disponivel: boolean): SituacaoMotorista {
  if (compativel) {
    return disponivel ? "OK" : "SEM_DESCANSO"
  }
  return disponivel ? "FORA_DA_REGRA" : "FORA_DA_REGRA_SEM_DESCANSO"
}

const ESTILO: Record<SituacaoMotorista, { classe: string; texto: string }> = {
  OK: { classe: "bg-success", texto: "Compatível e livre" },
  SEM_DESCANSO: { classe: "bg-warning", texto: "Compatível, mas sem descanso suficiente ou já em viagem" },
  FORA_DA_REGRA: {
    classe: "border border-muted-foreground/60 bg-transparent",
    texto: "Fora da regra (turno, dias, produto ou integração) — só em emergência",
  },
  FORA_DA_REGRA_SEM_DESCANSO: {
    classe: "bg-destructive",
    texto: "Fora da regra e sem descanso suficiente",
  },
}

/**
 * Ponto colorido antes do nome do motorista, no lugar de "(Compatível)",
 * "(Emergência)" etc. O significado vai no tooltip e num texto pra leitor de
 * tela — a cor nunca é a única informação.
 */
export function IndicadorCompatibilidade({ situacao, className }: { situacao: SituacaoMotorista; className?: string }) {
  const { classe, texto } = ESTILO[situacao]

  return (
    <span title={texto} className={cn("inline-flex size-3 shrink-0 items-center justify-center", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", classe)} />
      <span className="sr-only">{texto}</span>
    </span>
  )
}
