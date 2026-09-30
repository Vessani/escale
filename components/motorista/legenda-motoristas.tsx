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

/**
 * Legenda discreta das cores e ícones de motorista — fica perto da tabela,
 * pra ninguém precisar decorar. `mostrarSituacao` inclui as cores de
 * compatibilidade (só fazem sentido onde há seletor de motorista).
 */
export function LegendaMotoristas({ mostrarSituacao = true }: { mostrarSituacao?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {mostrarSituacao && (
        <>
          {SITUACOES.map(({ situacao, texto }) => (
            <span key={situacao} className="inline-flex items-center gap-1">
              <IndicadorCompatibilidade situacao={situacao} />
              {texto}
            </span>
          ))}
          <span aria-hidden className="h-3 w-px bg-border" />
        </>
      )}
      {TIPOS.map(({ tipo, texto }) => (
        <span key={tipo} className="inline-flex items-center gap-1">
          <IconeTipoMotorista tipo={tipo} />
          {texto}
        </span>
      ))}
    </div>
  )
}
