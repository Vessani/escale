import { notFound } from "next/navigation"
import { buscarFrotaPorId } from "@/lib/queries/frotas"
import FormEditarFrota from "./form-editar"
import { serializeData } from "@/lib/serialization"

export default async function EditarFrotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const frotaId = Number.parseInt(id, 10)

  if (Number.isNaN(frotaId)) {
    notFound()
  }

  const frota = await buscarFrotaPorId(frotaId)

  if (!frota) {
    notFound()
  }

  const frotaSerializada = serializeData(frota)

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Editar Conjunto</h1>
        <p className="text-slate-500 mt-1">Atualize a frota (cavalo/carreta) e a disponibilidade dela.</p>
      </div>
      <FormEditarFrota key={frota.id} frota={frotaSerializada} />
    </div>
  )
}
