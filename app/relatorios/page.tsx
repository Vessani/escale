import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { buscarIndicadoresDashboard } from "@/lib/queries/dashboard"
import { inicioDoDia, fimDoDia, parseDataLocal } from "@/lib/utils/date-format"
import RelatoriosClient from "./relatorios-client"
import DashboardRelatorios from "./dashboard-relatorios"
import Link from "next/link"
import { MoonStar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buscarRelatorioCircadiano } from "@/lib/queries/circadiano"
import { periodoCircadiano } from "@/lib/services/circadiano-periodo"

type SearchParamsInput = {
  de?: string
  ate?: string
}

/** YYYY-MM-DD local (sem componente de hora) — mesmo formato de <input type="date">. */
function dataLocalParaInput(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function periodoPadrao() {
  const hoje = new Date()
  const trintaDiasAtras = new Date(hoje)
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
  return { de: dataLocalParaInput(trintaDiasAtras), ate: dataLocalParaInput(hoje) }
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const padrao = periodoPadrao()
  const deTexto = parametros.de ?? padrao.de
  const ateTexto = parametros.ate ?? padrao.ate
  const de = inicioDoDia(parseDataLocal(deTexto))
  const ate = fimDoDia(parseDataLocal(ateTexto))

  const { filialId } = await requireSessaoPaginaComFilial()
  const periodoCircadianoPadrao = periodoCircadiano()!
  const [motoristas, indicadores, circadiano] = await Promise.all([
    buscarMotoristasParaSelect(filialId),
    buscarIndicadoresDashboard(filialId, de, ate),
    buscarRelatorioCircadiano(filialId, periodoCircadianoPadrao.de, periodoCircadianoPadrao.ate),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">
          Indicadores das viagens e planilhas Excel para operação e para os motoristas.
        </p>
      </div>

      <DashboardRelatorios indicadores={indicadores} de={deTexto} ate={ateTexto} />

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <MoonStar className="size-5 text-indigo-500" aria-hidden /> Ciclo circadiano
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Motoristas do dia que passam das 22:00 e da noite que passam das 05:00 — com início, fim, viagem e frota.
            </p>
            <p>
              <strong className={circadiano.previstas.length > 0 ? "text-destructive" : undefined}>
                {circadiano.previstas.length}
              </strong>{" "}
              {circadiano.previstas.length === 1 ? "viagem agendada vai passar" : "viagens agendadas vão passar"} do horário ·{" "}
              <strong>{circadiano.realizadas.length}</strong> {circadiano.realizadas.length === 1 ? "jornada passou" : "jornadas passaram"} nos últimos 7 dias
            </p>
          </div>
          <Button asChild>
            <Link href="/relatorios/circadiano">Abrir relatório</Link>
          </Button>
        </CardContent>
      </Card>

      <RelatoriosClient motoristas={motoristas.map(({ id, nome }) => ({ id, nome }))} />
    </div>
  )
}
