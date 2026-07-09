import { buscarViagemPorId } from "@/lib/queries/viagens"
import { buscarMotoristasParaSelect } from "@/lib/queries/motoristas"
import { motoristaEstaDisponivelNoPeriodo } from "@/lib/services/alocacao.service"
import { notFound } from "next/navigation"
import FormEditarViagem from "./form-editar"
import { serializeData } from "@/lib/serialization"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

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

  const inicioViagem = new Date(viagem.inicioPrevisto)
  const fimViagem = new Date(viagem.fimPrevisto)

  // Disponibilidade real (sem outra viagem ativa no mesmo período), ignorando
  // a própria viagem que está sendo editada — senão o motorista já alocado
  // nela apareceria como "ocupado" por causa da sua própria viagem.
  const motoristasComDisponibilidade = motoristas.map((motorista) => {
    const { viagens, ...dadosMotorista } = motorista
    const disponivel = motoristaEstaDisponivelNoPeriodo(
      { ...motorista, viagens: viagens.filter((v) => v.id !== viagem.id) },
      inicioViagem,
      fimViagem,
    )

    return { ...dadosMotorista, disponivel }
  })

  const viagemSerializada = serializeData(viagem)
  const motoristasSerializados = serializeData(motoristasComDisponibilidade)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Alocação e Edição</h1>
          <p className="text-slate-500 mt-1">
            Revise os dados da viagem Nº {viagem.numViagem} e confirme o motorista alocado.
          </p>
        </div>
        <Link href={`/api/viagens/${viagem.id}/pdf`}>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </Link>
      </div>

      <FormEditarViagem key={viagem.id} viagem={viagemSerializada} motoristas={motoristasSerializados} />
    </div>
  )
}