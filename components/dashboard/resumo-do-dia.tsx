import { Moon, Sun } from "lucide-react"
import type { StatusViagem } from "@prisma/client"
import { resumoPorTurno, viagemEncerrada } from "@/lib/services/dashboard.service"
import { cn } from "@/lib/utils"
import { classePontoStatusViagem } from "@/app/viagens/badge-styles"

/** Topo do Dashboard: contadores por status e a programação do dia por turno. */

const ROTULO_CONTADOR: Record<StatusViagem, string> = {
  CRIADA: "Criadas",
  ALOCADA: "Alocadas",
  INICIADA: "Iniciadas",
  RETORNANDO: "Retornando",
  POSTERGADA: "Postergadas",
  FINALIZADA: "Finalizadas",
  CANCELADA: "Canceladas",
}

const DICA_CONTADOR: Partial<Record<StatusViagem, string>> = {
  CRIADA: "Viagens ainda sem motorista.",
  RETORNANDO: "Inclui as que saíram em dias anteriores e ainda estão voltando.",
  FINALIZADA: "Finalizadas no dia — saem da lista, fica só o número.",
  CANCELADA: "Canceladas no dia — saem da lista, fica só o número.",
}

/** Contador de um status, com o ponto na cor do status (a mesma do seletor na lista). Encerradas ficam discretas. */
export function ContadorStatus({ status, valor }: { status: StatusViagem; valor: number }) {
  const encerrado = viagemEncerrada(status)
  const alerta = status === "CRIADA" && valor > 0
  return (
    <div
      title={DICA_CONTADOR[status]}
      className={cn("rounded-lg border p-3 shadow-sm", encerrado ? "bg-muted/50 shadow-none" : "bg-card")}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span aria-hidden className={cn("size-2 rounded-full", classePontoStatusViagem(status))} />
        {ROTULO_CONTADOR[status]}
      </p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tabular-nums",
          encerrado && "text-muted-foreground",
          alerta && "text-warning",
          valor === 0 && !encerrado && "text-muted-foreground/50",
        )}
      >
        {valor}
      </p>
    </div>
  )
}

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Programação do dia por turno: "Dia: 4 viagens · 7 entregas". */
export function ResumoTurnos({ resumo }: { resumo: ReturnType<typeof resumoPorTurno> }) {
  const linhas = [
    { rotulo: "Dia", icone: Sun, ...resumo.dia },
    { rotulo: "Noite", icone: Moon, ...resumo.noite },
  ]
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
      title="Viagens que começam no dia (sem as canceladas) e as entregas delas. Dia: início das 04:00 às 15:59; Noite: das 16:00 às 03:59."
    >
      {linhas.map(({ rotulo, icone: Icone, viagens, entregas }) => (
        <span key={rotulo} className="flex items-center gap-1.5 text-muted-foreground">
          <Icone aria-hidden className="size-4" />
          <span className="font-medium text-foreground">{rotulo}:</span>
          <span className="tabular-nums">
            {plural(viagens, "viagem", "viagens")} · {plural(entregas, "entrega", "entregas")}
          </span>
        </span>
      ))}
      <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5">
        <span className="font-medium text-foreground">Total:</span>
        <span className="tabular-nums text-foreground">
          {plural(resumo.total.viagens, "viagem", "viagens")} · {plural(resumo.total.entregas, "entrega", "entregas")}
        </span>
      </span>
    </div>
  )
}
