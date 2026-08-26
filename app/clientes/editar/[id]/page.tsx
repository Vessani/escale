import { notFound } from "next/navigation"
import { buscarClientePorId } from "@/lib/queries/clientes"
import { buscarHistoricoDaEntidade } from "@/lib/queries/auditoria"
import FormEditarCliente from "./form-editar"
import { HistoricoCard } from "@/components/auditoria/historico-card"
import { serializeData } from "@/lib/serialization"

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clienteId = Number.parseInt(id, 10)

  if (Number.isNaN(clienteId)) {
    notFound()
  }

  const [cliente, historico] = await Promise.all([
    buscarClientePorId(clienteId),
    buscarHistoricoDaEntidade("Cliente", clienteId),
  ])

  if (!cliente) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Editar Cliente</h1>
        <p className="text-slate-500 mt-1">Atualize o nome ou a exigência de integração.</p>
      </div>
      <FormEditarCliente key={cliente.id} cliente={cliente} />

      <HistoricoCard registros={serializeData(historico)} />
    </div>
  )
}
