"use client"

import * as React from "react"
import { ArrowRight, Clock, Truck } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RotaDestinos, type EntregaDaRota } from "@/components/viagem/rota-destinos"
import { classeBadgeTurno } from "@/app/viagens/badge-styles"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { formatarDataHoraPtBr, formatarHoraLocal } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

/** "01/10 07:00 → 19:18" (data no fim só se mudar de dia). */
function periodo(inicio: string, fim: string) {
  const dataInicio = formatarDataHoraPtBr(inicio).slice(0, 5)
  const dataFim = formatarDataHoraPtBr(fim).slice(0, 5)
  return `${dataInicio} ${formatarHoraLocal(inicio)} → ${dataFim === dataInicio ? "" : `${dataFim} `}${formatarHoraLocal(fim)}`
}

/**
 * Cartão de uma viagem a alocar — mesmo visual na tela de Alocação e na
 * revisão do import de planilha: cabeçalho com número, frota, horário,
 * turno e rota; avisos de frota; a escolha do motorista no corpo; e um
 * espaço à direita pros controles de cada tela (produto, salvar...).
 */
export function CartaoViagemAlocacao({
  numViagem,
  cavalo,
  carreta,
  inicioPrevisto,
  fimPrevisto,
  turno,
  entregas,
  avisos,
  etiquetas,
  lateral,
  children,
  className,
}: {
  numViagem: string
  cavalo: string
  carreta: string
  inicioPrevisto: string
  fimPrevisto: string
  turno: "MANHA" | "NOITE"
  entregas: EntregaDaRota[]
  /** Avisos curtos (rótulo + detalhe no tooltip). */
  avisos?: Array<{ rotulo: string; detalhe?: string }>
  /** Etiquetas extras no cabeçalho (produto, integração...). */
  etiquetas?: React.ReactNode
  /** Coluna da direita: controles da tela (produto, botões). */
  lateral?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <article className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <header className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Viagem <span className="font-mono tabular-nums">{numViagem}</span>
            </h3>
            <Badge variant="outline" className={classeBadgeTurno(turno)}>
              {turno === "NOITE" ? "Noite" : "Dia"}
            </Badge>
            {etiquetas}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Truck className="size-3.5" aria-hidden />
              {formatarCodigoFrota(cavalo)} / {formatarCodigoFrota(carreta)}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="size-3.5" aria-hidden />
              {periodo(inicioPrevisto, fimPrevisto)}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ArrowRight className="size-3.5 shrink-0" aria-hidden />
              <RotaDestinos entregas={entregas} className="px-0" />
              <span className="whitespace-nowrap text-xs">({entregas.length} entrega{entregas.length === 1 ? "" : "s"})</span>
            </span>
          </div>
          {avisos && avisos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {avisos.map((aviso) => (
                <Alert key={aviso.rotulo} variant="warning" inline title={aviso.detalhe}>
                  {aviso.rotulo}
                </Alert>
              ))}
            </div>
          )}
        </div>
      </header>
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">{children}</div>
        {lateral && <div className="flex flex-col gap-2 lg:w-56">{lateral}</div>}
      </div>
    </article>
  )
}
