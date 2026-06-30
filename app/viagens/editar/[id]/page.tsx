import { buscarViagemPorId } from "@/lib/queries/viagens"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { notFound } from "next/navigation"
import FormEditarViagem from "./form-editar"
import { serializeData } from "@/lib/serialization"

export default async function EditarViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viagemId = Number.parseInt(id, 10)

  if (Number.isNaN(viagemId)) {
    notFound()
  }

  const viagem = await buscarViagemPorId(viagemId)

  if (!viagem) {
    notFound()
  }

  const motoristas = await buscarMotoristasParaSelect()
  
  const viagemSerializada = serializeData(viagem)
  const motoristasSerializados = serializeData(motoristas)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Alocação e Edição</h1>
        <p className="text-slate-500 mt-1">
          Revise os dados da viagem Nº {viagem.numViagem} e confirme o motorista alocado.
        </p>
      </div>

      <FormEditarViagem viagem={viagemSerializada} motoristas={motoristasSerializados} />
    </div>
  )
}