import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, PlusCircle, Users } from "lucide-react"
import { buscarMotoristasComAgenda } from "@/lib/queries/motoristas"
import { serializeData } from "@/lib/serialization"
import CalendarioMotoristas from "./calendario-motoristas"
import {
  fimDoMes,
  formatarDataDia,
  formatarMesAno,
  formatarMesParam,
  gerarDiasDoMes,
  inicioDoMes,
  parseMesParam,
} from "./calendario-utils"

type SearchParamsInput = {
  mes?: string
}

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const hoje = new Date()
  const mesReferencia = parseMesParam(parametros.mes) ?? inicioDoMes(hoje)
  const primeiroDiaMes = inicioDoMes(mesReferencia)
  const ultimoDiaMes = fimDoMes(mesReferencia)
  const mesAnterior = inicioDoMes(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() - 1, 1))
  const proximoMes = inicioDoMes(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 1))
  const motoristas = await buscarMotoristasComAgenda(primeiroDiaMes, ultimoDiaMes)
  const dias = gerarDiasDoMes(mesReferencia)
  const mesParam = formatarMesParam(mesReferencia)
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
    })),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calendário de Motoristas</h1>
          <p className="text-slate-500 mt-1">
            Motoristas em linha e dias do mês em colunas ({formatarMesAno(mesReferencia)}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/motorista?mes=${formatarMesParam(mesAnterior)}`}>
            <Button variant="outline">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Mês anterior
            </Button>
          </Link>
          <Link href="/motorista">
            <Button variant="outline">Mês atual</Button>
          </Link>
          <Link href={`/motorista?mes=${formatarMesParam(proximoMes)}`}>
            <Button variant="outline">
              Próximo mês
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

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-semibold">Códigos:</span>
        <span className="rounded px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200">1-3 Jornada</span>
        <span className="rounded px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200">4-5 Jornada</span>
        <span className="rounded px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-200">6 Jornada</span>
        <span className="rounded px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-200">7 Folga</span>
        <span className="rounded px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200">8 Férias</span>
        <span className="rounded px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200">9 Exames</span>
        <span className="rounded px-2 py-0.5 bg-slate-200 text-slate-800 border border-slate-300">10 Interno</span>
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
          mesParam={mesParam}
          hojeIso={hoje.toISOString()}
          dias={diasIso}
          motoristas={calendarioSerializado}
        />
      )}
    </div>
  )
}