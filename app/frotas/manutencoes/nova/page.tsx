import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarVeiculosCadastrados } from "@/lib/queries/manutencoes"
import { formatDateTimeForInput } from "@/lib/utils/date-format"
import ManutencaoForm from "@/components/frota/manutencao-form"

type SearchParamsInput = { cavalo?: string; carreta?: string }

/** Próxima hora cheia — padrão do início previsto. */
function proximaHoraCheia(agora: Date) {
  const data = new Date(agora)
  data.setMinutes(0, 0, 0)
  data.setTime(data.getTime() + 60 * 60 * 1000)
  return data
}

export default async function NovaManutencaoPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const conjuntos = await buscarVeiculosCadastrados(filialId)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ManutencaoForm
        conjuntos={conjuntos}
        valoresIniciais={{
          veiculo: "CARRETA",
          codigo: parametros.carreta ?? "",
          tipo: "PREVENTIVA",
          nivel: null,
          responsavel: "WHITE_MARTINS",
          descricao: "",
          inicioPrevisto: formatDateTimeForInput(proximaHoraCheia(new Date())),
          fimPrevisto: "",
        }}
      />
    </div>
  )
}
