import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { buscarMatriculasCadastradas } from "@/lib/queries/motoristas"
import ImportarJornadaClient from "./importar-jornada-client"

export default async function ImportarJornadaPage() {
  const { filialId } = await requireSessaoPaginaComFilial()
  const matriculasCadastradas = await buscarMatriculasCadastradas(filialId)

  return <ImportarJornadaClient matriculasCadastradas={matriculasCadastradas} />
}
