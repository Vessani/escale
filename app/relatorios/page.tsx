import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import RelatoriosClient from "./relatorios-client"

export default async function RelatoriosPage() {
  const session = await getServerSession(authOptions)
  const filialId = session!.user.filialId!
  const motoristas = await buscarMotoristasParaSelect(filialId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios</h1>
        <p className="text-slate-500 mt-1">
          Baixe planilhas Excel com os dados de viagens para operação e para os motoristas.
        </p>
      </div>

      <RelatoriosClient motoristas={motoristas.map(({ id, nome }) => ({ id, nome }))} />
    </div>
  )
}
