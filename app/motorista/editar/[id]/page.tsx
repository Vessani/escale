import { notFound } from "next/navigation"
import { buscarMotoristaPorId } from "@/lib/queries/motoristas"
import FormEditarMotorista from "./form-editar"
import { serializeData } from "@/lib/serialization"
import { mapearRegistrosJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { inicioDoDia } from "@/lib/utils/date-format"

export default async function EditarMotoristaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const motoristaId = Number.parseInt(id, 10)

  if (Number.isNaN(motoristaId)) {
    notFound()
  }

  const motorista = await buscarMotoristaPorId(motoristaId)

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Editar Motorista</h1>
        <p className="text-slate-500 mt-1">Atualize os dados operacionais do condutor.</p>
      </div>
      <FormEditarMotorista key={motorista.id} motorista={motoristaSerializado} />
    </div>
  )
}
