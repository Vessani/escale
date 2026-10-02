import { notFound } from "next/navigation"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarFrotaPorId } from "@/lib/queries/frotas"
import { buscarHistoricoDaEntidade } from "@/lib/queries/auditoria"
import FormEditarFrota from "./form-editar"
import { HistoricoCard } from "@/components/auditoria/historico-card"
import { ehGerencia } from "@/lib/papeis"
import { serializeData } from "@/lib/serialization"

export default async function EditarFrotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const frotaId = Number.parseInt(id, 10)

  if (Number.isNaN(frotaId)) {
    notFound()
  }

  const { filialId, session } = await requireSessaoPaginaComFilial()
  const verHistorico = ehGerencia(session.user.role)

  const [frota, historico] = await Promise.all([
    buscarFrotaPorId(filialId, frotaId),
    verHistorico ? buscarHistoricoDaEntidade("Frota", frotaId) : null,
  ])

  if (!frota) {
    notFound()
  }

  const frotaSerializada = serializeData(frota)

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Editar Conjunto</h1>
        <p className="text-muted-foreground mt-1">Atualize a frota (cavalo/carreta) e a disponibilidade dela.</p>
      </div>
      <FormEditarFrota key={frota.id} frota={frotaSerializada} />

      {historico && <HistoricoCard registros={serializeData(historico)} />}
    </div>
  )
}
