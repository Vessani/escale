import { notFound } from "next/navigation"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import { buscarClientes } from "@/lib/queries/clientes"
import { buscarHistoricoDaEntidade } from "@/lib/queries/auditoria"
import FormEditarMotorista from "./form-editar"
import { HistoricoCard } from "@/components/auditoria/historico-card"
import { ehGerencia } from "@/lib/papeis"
import { serializeData } from "@/lib/serialization"
import { mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { inicioDoDia } from "@/lib/utils/date-format"
import { AcessoMotoristaCard } from "@/components/motorista/acesso-motorista-card"
import { situacaoAcessoMotorista } from "@/lib/services/acesso-motorista.service"

export default async function EditarMotoristaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const motoristaId = Number.parseInt(id, 10)

  if (Number.isNaN(motoristaId)) {
    notFound()
  }

  const { filialId, session } = await requireSessaoPaginaComFilial()
  const verHistorico = ehGerencia(session.user.role)

  const [motorista, clientes, historico, acesso] = await Promise.all([
    buscarMotoristaPorId(filialId, motoristaId),
    buscarClientes(),
    verHistorico ? buscarHistoricoDaEntidade("Motorista", motoristaId) : null,
    situacaoAcessoMotorista(filialId, motoristaId),
  ])

  if (!motorista) {
    notFound()
  }

  // O campo "Dias Trabalhados" do formulário deve refletir a jornada real de
  // hoje, projetada a partir do histórico — não o cache diasTrabalhados cru,
  // que pode estar parado desde a última vez que algo escreveu no dia de hoje.
  const hoje = inicioDoDia(new Date())
  const codigoHoje = projetarCodigoNoDia(
    mapearRegistrosJornada(motorista.registrosJornada),
    hoje,
    hoje,
    motorista.diasTrabalhados,
  )

  const motoristaSerializado = serializeData({ ...motorista, diasTrabalhados: codigoHoje })

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar Motorista</h1>
        <p className="text-muted-foreground mt-1">Atualize os dados operacionais do condutor.</p>
      </div>
      <FormEditarMotorista key={motorista.id} motorista={motoristaSerializado} clientes={clientes} />

      <AcessoMotoristaCard motoristaId={motorista.id} seva={motorista.seva} situacao={acesso} />

      {historico && <HistoricoCard registros={serializeData(historico)} />}
    </div>
  )
}
