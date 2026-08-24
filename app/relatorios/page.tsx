import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { buscarIndicadoresDashboard } from "@/lib/queries/dashboard"
import { inicioDoDia, fimDoDia, parseDataLocal } from "@/lib/utils/date-format"
import RelatoriosClient from "./relatorios-client"
import DashboardRelatorios from "./dashboard-relatorios"

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

  const session = await getServerSession(authOptions)
  const filialId = session!.user.filialId!
  const [motoristas, indicadores] = await Promise.all([
    buscarMotoristasParaSelect(filialId),
    buscarIndicadoresDashboard(filialId, de, ate),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios</h1>
        <p className="text-slate-500 mt-1">
          Indicadores das viagens e planilhas Excel para operação e para os motoristas.
        </p>
      </div>

      <DashboardRelatorios indicadores={indicadores} de={deTexto} ate={ateTexto} />

      <RelatoriosClient motoristas={motoristas.map(({ id, nome }) => ({ id, nome }))} />
    </div>
  )
}
