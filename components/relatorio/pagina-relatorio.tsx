import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Download } from "lucide-react"
import type { Turno } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { classeBadgeTurno } from "@/app/viagens/badge-styles"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import type { Periodo } from "@/lib/relatorios/periodo"
import { rotuloTurno } from "@/lib/relatorios/formato"

/** Topo das telas de relatório: voltar pra Relatórios, título e uma frase do que entra. */
export function CabecalhoRelatorio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Link href="/relatorios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" aria-hidden /> Relatórios
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  )
}

/**
 * Filtro GET (a URL é o estado) + botão do Excel com os mesmos filtros.
 * `children` = campos extras (ex: limite de horas), que precisam ter `name`
 * — vão juntos pro Excel via `exportarQuery`.
 */
export function FiltroRelatorio({
  action,
  periodo,
  exportarTipo,
  exportarQuery,
  children,
}: {
  action: string
  periodo?: Periodo
  exportarTipo: string
  exportarQuery: Record<string, string | number | undefined>
  children?: React.ReactNode
}) {
  const query = new URLSearchParams(
    Object.entries(exportarQuery).flatMap(([chave, valor]) => (valor === undefined ? [] : [[chave, String(valor)]])),
  ).toString()

  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      {periodo && (
        <>
          <label className="grid gap-1 text-xs text-muted-foreground">
            De
            <Input type="date" name="de" defaultValue={periodo.deTexto} className="h-8 w-40 text-xs" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Até
            <Input type="date" name="ate" defaultValue={periodo.ateTexto} className="h-8 w-40 text-xs" />
          </label>
        </>
      )}
      {children}
      {(periodo || children) && <Button type="submit" size="sm" variant="outline">Filtrar</Button>}
      <Button asChild size="sm" className="ml-auto">
        <a href={`/api/relatorios/exportar/${exportarTipo}${query ? `?${query}` : ""}`}>
          <Download className="size-4 mr-1.5" aria-hidden /> Baixar Excel
        </a>
      </Button>
    </form>
  )
}

/** Título de uma parte da tela de relatório. */
export function SecaoRelatorio({ titulo, descricao, children }: { titulo: string; descricao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

/** Moldura das tabelas de relatório (rolagem horizontal no celular). */
export function MolduraTabela({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">{children}</div>
}

export function BadgeTurno({ turno }: { turno: Turno }) {
  return (
    <Badge variant="outline" className={classeBadgeTurno(turno)}>
      {rotuloTurno(turno)}
    </Badge>
  )
}

export function BadgeAtividade({ atividade }: { atividade: "VIAGEM" | "INTERNO" }) {
  return atividade === "VIAGEM" ? (
    <Badge variant="outline">Viagem</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">Interno</Badge>
  )
}

export function textoFrota(cavalo: string | null, carreta: string | null): string {
  return cavalo || carreta ? `${formatarCodigoFrota(cavalo ?? "")} / ${formatarCodigoFrota(carreta ?? "")}` : "—"
}
