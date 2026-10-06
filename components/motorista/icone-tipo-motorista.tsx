import type { TipoMotorista } from "@prisma/client"
import { Award, Building2, Droplets, GraduationCap, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { descreverTipoMotorista, formatarTipoMotorista } from "@/lib/services/tipo-motorista"

const ICONES: Record<Exclude<TipoMotorista, "MOTORISTA">, { Icone: LucideIcon; cor: string }> = {
  TREINAMENTO: { Icone: GraduationCap, cor: "text-warning" },
  INSTRUTOR: { Icone: Award, cor: "text-info" },
  INTERNO: { Icone: Building2, cor: "text-muted-foreground" },
  ENCHEDOR: { Icone: Droplets, cor: "text-muted-foreground" },
}

/**
 * Ícone pequeno do tipo de motorista, pra ir ao lado do nome no lugar de
 * sufixos como "(Em treinamento)". Motorista comum não tem ícone — o nome
 * fica limpo no caso mais frequente. O nome do tipo vai no tooltip (title)
 * e num texto só pra leitor de tela.
 */
export function IconeTipoMotorista({ tipo, className }: { tipo: TipoMotorista; className?: string }) {
  if (tipo === "MOTORISTA") {
    return null
  }

  const { Icone, cor } = ICONES[tipo]
  const titulo = `${formatarTipoMotorista(tipo)} — ${descreverTipoMotorista(tipo)}`

  return (
    <span title={titulo} className={cn("inline-flex shrink-0 items-center", cor, className)}>
      <Icone aria-hidden className="size-3.5" />
      <span className="sr-only">{formatarTipoMotorista(tipo)}</span>
    </span>
  )
}

/**
 * Nome + ícone do tipo, alinhados — o jeito padrão de mostrar um motorista
 * em lista/select. O nome aparece como nome próprio ("Francinei Paulino"),
 * não em maiúsculas como vem da planilha; o cadastro continua igual.
 */
export function NomeMotorista({ nome, tipo, className }: { nome: string; tipo: TipoMotorista; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate" title={nome}>
        {formatarNomeProprio(nome)}
      </span>
      <IconeTipoMotorista tipo={tipo} />
    </span>
  )
}
