import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, PlusCircle, Users } from "lucide-react"
import { buscarMotoristasComAgenda } from "@/lib/queries/motoristas"
import { calcularDiasDisponiveis } from "@/lib/services/alocacao.service"

type MotoristaComAgenda = Awaited<ReturnType<typeof buscarMotoristasComAgenda>>[number]
type ViagemDoMotorista = MotoristaComAgenda["viagens"][number]

function inicioDoDia(data: Date) {
  const dia = new Date(data)
  dia.setHours(0, 0, 0, 0)
  return dia
}

function fimDoDia(data: Date) {
  const dia = new Date(data)
  dia.setHours(23, 59, 59, 999)
  return dia
}

function inicioDoMes(data: Date) {
  return inicioDoDia(new Date(data.getFullYear(), data.getMonth(), 1))
}

function fimDoMes(data: Date) {
  return fimDoDia(new Date(data.getFullYear(), data.getMonth() + 1, 0))
}

function parseMesParam(valor?: string) {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) {
    return null
  }

  const [anoTexto, mesTexto] = valor.split("-")
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)

  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null
  }

  return inicioDoMes(new Date(ano, mes - 1, 1))
}

function formatarMesParam(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  return `${ano}-${mes}`
}

function formatarMesAno(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(data)
}

function gerarDiasDoMes(data: Date) {
  const ano = data.getFullYear()
  const mes = data.getMonth()
  const totalDias = new Date(ano, mes + 1, 0).getDate()

  return Array.from({ length: totalDias }, (_, index) => new Date(ano, mes, index + 1))
}

function formatarSemana(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  }).format(data)
}

function diferencaEmDias(dataA: Date, dataB: Date) {
  const inicioA = inicioDoDia(dataA).getTime()
  const inicioB = inicioDoDia(dataB).getTime()
  return Math.round((inicioA - inicioB) / 86_400_000)
}

function calcularCodigoJornadaNoDia(codigoAtual: number, dia: Date, hoje: Date) {
  if (codigoAtual >= 8 && codigoAtual <= 10) {
    return codigoAtual
  }

  if (codigoAtual < 1 || codigoAtual > 7) {
    return codigoAtual
  }

  const deslocamento = diferencaEmDias(dia, hoje)
  const base = codigoAtual - 1
  const rotacao = ((base + deslocamento) % 7 + 7) % 7
  return rotacao + 1
}

function obterStatusJornada(diasTrabalhados: number) {
  if (diasTrabalhados >= 1 && diasTrabalhados <= 3) {
    return { texto: `${diasTrabalhados}º dia`, classe: "bg-emerald-100 text-emerald-800 border border-emerald-200" }
  }

  if (diasTrabalhados >= 4 && diasTrabalhados <= 5) {
    return { texto: `${diasTrabalhados}º dia`, classe: "bg-yellow-100 text-yellow-800 border border-yellow-200" }
  }

  if (diasTrabalhados === 6) {
    return { texto: "6º dia", classe: "bg-orange-100 text-orange-800 border border-orange-200" }
  }

  if (diasTrabalhados === 7) {
    return { texto: "Folga", classe: "bg-sky-100 text-sky-800 border border-sky-200" }
  }

  if (diasTrabalhados === 8) {
    return { texto: "Férias", classe: "bg-indigo-100 text-indigo-800 border border-indigo-200" }
  }

  if (diasTrabalhados === 9) {
    return { texto: "Exames", classe: "bg-rose-100 text-rose-800 border border-rose-200" }
  }

  if (diasTrabalhados === 10) {
    return { texto: "Interno", classe: "bg-slate-200 text-slate-800 border border-slate-300" }
  }

  return { texto: String(diasTrabalhados), classe: "bg-slate-100 text-slate-700 border border-slate-200" }
}

type SearchParamsInput =
  | Promise<{ mes?: string }>
  | { mes?: string }
  | undefined

export default async function MotoristasPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const parametros = (await searchParams) ?? {}
  const hoje = new Date()
  const mesReferencia = parseMesParam(parametros.mes) ?? inicioDoMes(hoje)
  const primeiroDiaMes = inicioDoMes(mesReferencia)
  const ultimoDiaMes = fimDoMes(mesReferencia)
  const mesAnterior = inicioDoMes(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() - 1, 1))
  const proximoMes = inicioDoMes(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 1))
  const motoristas = await buscarMotoristasComAgenda(primeiroDiaMes, ultimoDiaMes)
  const dias = gerarDiasDoMes(mesReferencia)

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
        <div className="space-y-4">
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1600px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-50 border-b border-r px-4 py-3 text-left font-semibold text-slate-700 min-w-80">
                    Motorista
                  </th>
                  {dias.map((dia) => (
                    <th key={dia.toISOString()} className="border-b border-r px-2 py-3 text-center align-top min-w-20">
                      <div className="font-semibold text-slate-700">{dia.getDate()}</div>
                      <div className="text-[11px] uppercase text-slate-500">{formatarSemana(dia)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {motoristas.map((motorista: MotoristaComAgenda) => {
                  const diasDisponiveis = calcularDiasDisponiveis(motorista.diasTrabalhados)
                  const statusJornada = obterStatusJornada(motorista.diasTrabalhados)

                  return (
                    <tr key={motorista.id} className="odd:bg-white even:bg-slate-50/40">
                      <td className="sticky left-0 z-10 bg-inherit border-r border-b px-4 py-3 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Link href={`/motorista/editar/${motorista.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                              {motorista.nome}
                            </Link>
                            <Badge variant={motorista.turno === "MANHA" ? "default" : "secondary"}>
                              {motorista.turno}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>SEVA {motorista.seva}</span>
                            <span>·</span>
                            <span>{diasDisponiveis} dia(s) disponível(is)</span>
                            <span>·</span>
                            <span className={`rounded px-2 py-0.5 font-semibold ${statusJornada.classe}`}>
                              {statusJornada.texto}
                            </span>
                          </div>
                        </div>
                      </td>
                      {dias.map((dia) => {
                        const viagensNoDia = motorista.viagens.filter((viagem: ViagemDoMotorista) => {
                          const inicio = new Date(viagem.inicioPrevisto)
                          const fim = new Date(viagem.fimPrevisto)
                          return inicio <= fimDoDia(dia) && fim >= inicioDoDia(dia)
                        })
                        const codigoNoDia = calcularCodigoJornadaNoDia(motorista.diasTrabalhados, dia, hoje)
                        const statusNoDia = obterStatusJornada(codigoNoDia)

                        return (
                          <td key={`${motorista.id}-${dia.toISOString()}`} className="border-r border-b px-2 py-2 align-top text-center">
                            <div className="space-y-1">
                              <div className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${statusNoDia.classe}`}>
                                {statusNoDia.texto}
                              </div>
                              {viagensNoDia.length > 0 ? (
                                <div className="space-y-1">
                                  {viagensNoDia.map((viagem: ViagemDoMotorista) => (
                                    <div key={viagem.id} className="rounded-md border border-blue-200 bg-blue-50 p-1 text-xs">
                                      <div className="font-semibold text-blue-900">{viagem.numViagem}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">Sem viagem</span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}