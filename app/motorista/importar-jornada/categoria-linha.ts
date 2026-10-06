import { folgaEstourada } from "@/lib/services/dias-sem-folga"
import type { LinhaRevisaoJornada } from "@/lib/parsers/jornada-relatorio-parser"

/**
 * Cor da linha inteira na conferência, da mais grave pra menos:
 * - SETIMO_DIA: 7º dia seguido ou mais (vermelho);
 * - EDITADA: você mexeu (azul) — inclui linha ignorada;
 * - CORRIGIDA: o sistema corrigiu (laranja) — batidas unidas, batida extra
 *   desconsiderada, dias diferente do relatório;
 * - SEM_PAR: batida sozinha, o fim pode não ser o real (amarelo);
 * - FORA: não entra no calendário por regra (cinza) — batida extra absorvida
 *   ou outra jornada mais tarde no mesmo dia;
 * - OK: nada a conferir.
 */
export type CategoriaLinha = "SETIMO_DIA" | "EDITADA" | "CORRIGIDA" | "SEM_PAR" | "FORA" | "OK"

export function categoriaDaLinha(linha: LinhaRevisaoJornada): CategoriaLinha {
  if (linha.situacao === "IGNORADA") return "EDITADA"
  if (linha.situacao === "ABSORVIDA" || linha.situacao === "MESMO_DIA") return linha.editada ? "EDITADA" : "FORA"
  if (folgaEstourada(linha.diasSemFolga)) return "SETIMO_DIA"
  if (linha.editada) return "EDITADA"
  if (linha.correcao === "BATIDAS_UNIDAS" || linha.correcao === "BATIDA_EXTRA" || linha.diasSemFolga !== linha.diasSemFolgaRelatorio) {
    return "CORRIGIDA"
  }
  if (linha.correcao === "BATIDA_SEM_PAR") return "SEM_PAR"
  return "OK"
}

/** Linha que pede um olhar antes de confirmar (tudo menos OK). */
export function precisaAtencao(categoria: CategoriaLinha) {
  return categoria !== "OK"
}

export const ESTILO_CATEGORIA: Record<CategoriaLinha, { linha: string; ponto: string }> = {
  SETIMO_DIA: {
    linha:
      "bg-destructive/10 text-destructive hover:bg-destructive/15 font-medium [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-destructive",
    ponto: "bg-destructive",
  },
  EDITADA: {
    linha: "bg-info/10 hover:bg-info/15 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-info",
    ponto: "bg-info",
  },
  CORRIGIDA: {
    linha: "bg-warning/10 hover:bg-warning/15 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-warning",
    ponto: "bg-warning",
  },
  SEM_PAR: {
    linha: "bg-atencao/15 hover:bg-atencao/25 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-atencao",
    ponto: "bg-atencao",
  },
  FORA: {
    linha: "bg-muted/60 text-muted-foreground [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-border",
    ponto: "bg-muted-foreground/40",
  },
  OK: { linha: "", ponto: "" },
}
