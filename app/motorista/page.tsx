import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, PlusCircle, Users } from "lucide-react"
import { buscarMotoristasComAgenda } from "@/lib/queries/motoristas"
import { reconciliarFolgaDeTodosMotoristas } from "@/lib/services/folga.service"
import { serializeData } from "@/lib/serialization"
import { fimDoDia, inicioDoDia } from "@/lib/utils/date-format"
import CalendarioMotoristas from "./calendario-motoristas"
import {
  formatarDataDia,
  formatarIntervaloDias,
  gerarJanelaDias,
  parseDataInicioParam,
  TAMANHO_JANELA_CALENDARIO,
} from "./calendario-utils"

type SearchParamsInput = {
  inicio?: string
}

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const hoje = new Date()
  const inicioJanela = parseDataInicioParam(parametros.inicio) ?? inicioDoDia(hoje)
  const dias = gerarJanelaDias(inicioJanela, TAMANHO_JANELA_CALENDARIO)
  const fimJanela = fimDoDia(dias[dias.length - 1])
  const janelaAnterior = new Date(inicioJanela)
  janelaAnterior.setDate(janelaAnterior.getDate() - TAMANHO_JANELA_CALENDARIO)
  const janelaSeguinte = new Date(inicioJanela)
  janelaSeguinte.setDate(janelaSeguinte.getDate() + TAMANHO_JANELA_CALENDARIO)

  // Pega em dia qualquer motorista com folga desatualizada (ver reconciliarFolgaDeTodosMotoristas).
  await reconciliarFolgaDeTodosMotoristas(hoje)

  const motoristas = await buscarMotoristasComAgenda(inicioJanela, fimJanela)
  const inicioParam = formatarDataDia(inicioJanela)
  const diasIso = dias.map((dia) => formatarDataDia(dia))
  const calendarioSerializado = serializeData(
    motoristas.map((motorista) => ({
      id: motorista.id,
      nome: motorista.nome,
      turno: motorista.turno,
      seva: motorista.seva,
      diasTrabalhados: motorista.diasTrabalhados,
      viagens: motorista.viagens.map((viagem) => ({
        id: viagem.id,
        numViagem: viagem.numViagem,
        inicioPrevisto: viagem.inicioPrevisto,
        fimPrevisto: viagem.fimPrevisto,
      })),
      registrosJornada: motorista.registrosJornada.map((registro) => ({
        data: registro.data,
        codigo: registro.codigo,
      })),
    })),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calendário de Motoristas</h1>
          <p className="text-slate-500 mt-1">
            Motoristas em linha e dias em colunas, a partir de hoje ({formatarIntervaloDias(inicioJanela, dias[dias.length - 1])}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/motorista?inicio=${formatarDataDia(janelaAnterior)}`}>
            <Button variant="outline">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Dias anteriores
            </Button>
          </Link>
          <Link href="/motorista">
            <Button variant="outline">Hoje</Button>
          </Link>
          <Link href={`/motorista?inicio=${formatarDataDia(janelaSeguinte)}`}>
            <Button variant="outline">
              Próximos dias
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/motorista/novo">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <PlusCircle className="w-5 h-5 mr-2" />
              Novo Motorista
            </Button>
          </Link>
        </div>
      </div>

      {motoristas.length === 0 ? (
        <div className="border rounded-lg bg-white shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mb-2" />
            <p>Nenhum motorista cadastrado ainda.</p>
          </div>
        </div>
      ) : (
        <CalendarioMotoristas
          inicioParam={inicioParam}
          hojeIso={hoje.toISOString()}
          dias={diasIso}
          motoristas={calendarioSerializado}
        />
      )}
    </div>
  )
}