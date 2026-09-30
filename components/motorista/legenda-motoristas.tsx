import { IconeTipoMotorista } from "@/components/motorista/icone-tipo-motorista"
import { IndicadorCompatibilidade, type SituacaoMotorista } from "@/components/motorista/indicador-compatibilidade"
import type { TipoMotorista } from "@prisma/client"

const SITUACOES: Array<{ situacao: SituacaoMotorista; texto: string }> = [
  { situacao: "OK", texto: "Livre" },
  { situacao: "SEM_DESCANSO", texto: "Sem descanso" },
  { situacao: "FORA_DA_REGRA", texto: "Fora da regra" },
  { situacao: "FORA_DA_REGRA_SEM_DESCANSO", texto: "Os dois" },
]

const TIPOS: Array<{ tipo: TipoMotorista; texto: string }> = [
  { tipo: "TREINAMENTO", texto: "Treinamento" },
  { tipo: "INSTRUTOR", texto: "Instrutor" },
  { tipo: "INTERNO", texto: "Interno" },
]

/** Legenda discreta das cores e ícones usados nos seletores de motorista — fica perto da tabela, pra ninguém precisar decorar. */
export function LegendaMotoristas() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {SITUACOES.map(({ situacao, texto }) => (
        <span key={situacao} className="inline-flex items-center gap-1">
          <IndicadorCompatibilidade situacao={situacao} />
          {texto}
        </span>
      ))}
      <span aria-hidden className="h-3 w-px bg-border" />
      {TIPOS.map(({ tipo, texto }) => (
        <span key={tipo} className="inline-flex items-center gap-1">
          <IconeTipoMotorista tipo={tipo} />
          {texto}
        </span>
      ))}
    </div>
  )
}
