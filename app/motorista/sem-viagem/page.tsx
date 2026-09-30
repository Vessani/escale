import { UserX } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarMotoristasSemViagemHoje, contarMotoristasAtivos } from "@/lib/queries/motoristas"
import { mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { determinarAcaoSugerida } from "@/lib/services/motoristas-ociosos.service"
import { formatarDataDia } from "../calendario-utils"
import SemViagemClient from "./sem-viagem-client"

export default async function MotoristasSemViagemPage() {
  const { filialId } = await requireSessaoPaginaComFilial()
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Motoristas Sem Viagem Hoje</h1>
        <p className="text-muted-foreground mt-1">
          {motoristasComAcao.length} de {totalMotoristas} motoristas sem viagem hoje, com a ação sugerida.
        </p>
      </div>

      {motoristasComAcao.length === 0 ? (
        <EmptyState icone={UserX} titulo="Todos em viagem" descricao="Todos os motoristas estão em viagem hoje." />
      ) : (
        <SemViagemClient motoristas={motoristasComAcao} dataReferencia={formatarDataDia(hoje)} />
      )}
    </div>
  )
}
