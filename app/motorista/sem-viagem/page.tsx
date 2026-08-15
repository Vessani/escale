import { getServerSession } from "next-auth"
import { UserX } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { buscarMotoristasSemViagemHoje, contarMotoristasAtivos } from "@/lib/queries/motoristas"
import { mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { determinarAcaoSugerida } from "@/lib/services/motoristas-ociosos.service"
import { formatarDataDia } from "../calendario-utils"
import SemViagemClient from "./sem-viagem-client"

export default async function MotoristasSemViagemPage() {
  const session = await getServerSession(authOptions)
  const filialId = session!.user.filialId!
  const hoje = new Date()

  const [motoristas, totalMotoristas] = await Promise.all([
    buscarMotoristasSemViagemHoje(filialId, hoje),
    contarMotoristasAtivos(filialId),
  ])

  const motoristasComAcao = motoristas.map((motorista) => {
    const registrosProjetados = mapearRegistrosJornada(motorista.registrosJornada)
    const codigoHoje = projetarCodigoNoDia(registrosProjetados, hoje, hoje, motorista.diasTrabalhados)
    return {
      id: motorista.id,
      nome: motorista.nome,
      seva: motorista.seva,
      turno: motorista.turno,
      liberado: motorista.liberado,
      codigoHoje,
      acao: determinarAcaoSugerida(codigoHoje, motorista.liberado),
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Motoristas Sem Viagem Hoje</h1>
        <p className="text-slate-500 mt-1">
          {motoristasComAcao.length} de {totalMotoristas} motoristas cadastrados estão sem viagem hoje — confira a ação sugerida pra cada um.
        </p>
      </div>

      {motoristasComAcao.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <UserX className="w-8 h-8 text-slate-300 mb-2" />
            <p>Todos os motoristas estão em viagem hoje.</p>
          </div>
        </div>
      ) : (
        <SemViagemClient motoristas={motoristasComAcao} dataReferencia={formatarDataDia(hoje)} />
      )}
    </div>
  )
}
