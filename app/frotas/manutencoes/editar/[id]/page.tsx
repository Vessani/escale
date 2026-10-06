import { notFound } from "next/navigation"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarManutencaoPorId, buscarVeiculosCadastrados } from "@/lib/queries/manutencoes"
import { formatDateTimeForInput } from "@/lib/utils/date-format"
import ManutencaoForm from "@/components/frota/manutencao-form"

export default async function EditarManutencaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const manutencaoId = Number.parseInt(id, 10)
  if (!Number.isInteger(manutencaoId)) notFound()

  const { filialId } = await requireSessaoPaginaComFilial()
  const [manutencao, conjuntos] = await Promise.all([buscarManutencaoPorId(filialId, manutencaoId), buscarVeiculosCadastrados(filialId)])
  if (!manutencao) notFound()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ManutencaoForm
        manutencaoId={manutencao.id}
        conjuntos={conjuntos}
        valoresIniciais={{
          veiculo: manutencao.veiculo,
          codigo: manutencao.codigo,
          tipo: manutencao.tipo,
          nivel: manutencao.nivel,
          responsavel: manutencao.responsavel,
          descricao: manutencao.descricao ?? "",
          inicioPrevisto: formatDateTimeForInput(manutencao.inicioPrevisto),
          fimPrevisto: manutencao.fimPrevisto ? formatDateTimeForInput(manutencao.fimPrevisto) : "",
        }}
      />
    </div>
  )
}
