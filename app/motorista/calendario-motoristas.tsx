"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { atualizarJornadaMotoristaNoCalendario, deletarMotorista } from "@/lib/actions/motoristas"
import { calcularDiasDisponiveis } from "@/lib/services/alocacao.service"
import { calcularCodigoJornadaNoDia, obterStatusJornada } from "@/lib/services/jornada.service"
import { fimDoDia, formatarSemana, inicioDoDia, OPCOES_CODIGO_JORNADA } from "./calendario-utils"

type Viagem = {
  id: number
  numViagem: string
  inicioPrevisto: string
  fimPrevisto: string
}

type Motorista = {
  id: number
  nome: string
  turno: "MANHA" | "NOITE"
  seva: number
  diasTrabalhados: number
  viagens: Viagem[]
}

type Props = {
  mesParam: string
  hojeIso: string
  dias: string[]
  motoristas: Motorista[]
}

export default function CalendarioMotoristas({ mesParam, hojeIso, dias, motoristas }: Props) {
  const router = useRouter()
  const [celulaEmEdicao, setCelulaEmEdicao] = useState<string | null>(null)
  const [celulaSalvando, setCelulaSalvando] = useState<string | null>(null)
  const [motoristaExcluindoId, setMotoristaExcluindoId] = useState<number | null>(null)
  const [mensagemErro, setMensagemErro] = useState("")
  const [isPending, startTransition] = useTransition()

  const hoje = useMemo(() => new Date(hojeIso), [hojeIso])

  const salvarJornada = (motoristaId: number, diaIso: string, codigoNoDia: number) => {
    const chaveCelula = `${motoristaId}-${diaIso}`
    setCelulaSalvando(chaveCelula)
    setMensagemErro("")

    startTransition(async () => {
      const resposta = await atualizarJornadaMotoristaNoCalendario(motoristaId, diaIso, codigoNoDia)
      setCelulaSalvando(null)
      setCelulaEmEdicao(null)

      if (!resposta.sucesso) {
        setMensagemErro(resposta.erro ?? "Não foi possível atualizar a jornada.")
        return
      }

      router.replace(`/motorista?mes=${mesParam}`)
      router.refresh()
    })
  }

  const excluirMotorista = (motoristaId: number, nomeMotorista: string) => {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o motorista ${nomeMotorista}?`,
    )

    if (!confirmar) {
      return
    }

    setMensagemErro("")
    setMotoristaExcluindoId(motoristaId)

    startTransition(async () => {
      const resposta = await deletarMotorista(motoristaId)
      setMotoristaExcluindoId(null)

      if (!resposta.sucesso) {
        setMensagemErro(resposta.erro ?? "Não foi possível excluir o motorista.")
        return
      }

      router.replace(`/motorista?mes=${mesParam}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Clique no status de qualquer célula para abrir o seletor e salvar imediatamente.
      </p>
      {mensagemErro ? <p className="text-sm text-red-600">{mensagemErro}</p> : null}

      <div className="isolate overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1600px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-40 bg-slate-50 border-b border-r px-4 py-3 text-left font-semibold text-slate-700 min-w-80 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.2)]">
                Motorista
              </th>
              {dias.map((diaIso) => {
                const dia = new Date(`${diaIso}T00:00:00`)
                return (
                  <th key={diaIso} className="border-b border-r px-2 py-3 text-center align-top min-w-20 bg-slate-50">
                    <div className="font-semibold text-slate-700">{dia.getDate()}</div>
                    <div className="text-[11px] uppercase text-slate-500">{formatarSemana(dia)}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {motoristas.map((motorista, indiceMotorista) => {
              const diasDisponiveis = calcularDiasDisponiveis(motorista.diasTrabalhados)
              const statusJornada = obterStatusJornada(motorista.diasTrabalhados)
              const fundoColunaFixa = indiceMotorista % 2 === 0 ? "bg-white" : "bg-slate-50"
              const classeTurnoBadge =
                motorista.turno === "MANHA"
                  ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
                  : "border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-100"

              return (
                <tr key={motorista.id} className="odd:bg-white even:bg-slate-50/40">
                  <td className={`sticky left-0 z-30 ${fundoColunaFixa} border-r border-b px-4 py-3 align-top shadow-[4px_0_6px_-4px_rgba(15,23,42,0.15)]`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/motorista/editar/${motorista.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                          {motorista.nome}
                        </Link>
                        <Badge variant="outline" className={classeTurnoBadge}>
                          {motorista.turno}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/motorista/editar/${motorista.id}`}>
                          <Button variant="outline" size="sm">
                            Editar
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          disabled={isPending}
                          onClick={() => excluirMotorista(motorista.id, motorista.nome)}
                        >
                          {motoristaExcluindoId === motorista.id ? "Excluindo..." : "Excluir"}
                        </Button>
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

                  {dias.map((diaIso) => {
                    const chaveCelula = `${motorista.id}-${diaIso}`
                    const dia = new Date(`${diaIso}T00:00:00`)
                    const codigoNoDia = calcularCodigoJornadaNoDia(motorista.diasTrabalhados, dia, hoje)
                    const statusNoDia = obterStatusJornada(codigoNoDia)
                    const celulaAberta = celulaEmEdicao === chaveCelula
                    const celulaOcupada = celulaSalvando === chaveCelula

                    const viagensNoDia = motorista.viagens.filter((viagem) => {
                      const inicio = new Date(viagem.inicioPrevisto)
                      const fim = new Date(viagem.fimPrevisto)
                      return inicio <= fimDoDia(dia) && fim >= inicioDoDia(dia)
                    })

                    return (
                      <td key={chaveCelula} className={`border-r border-b px-2 py-2 align-top text-center ${celulaAberta ? "relative z-10" : ""}`}>
                        <div className="space-y-1">
                          {celulaAberta ? (
                            <select
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                              defaultValue={String(codigoNoDia)}
                              disabled={celulaOcupada || isPending}
                              onChange={(evento) => {
                                salvarJornada(motorista.id, diaIso, Number(evento.target.value))
                              }}
                              onBlur={() => {
                                if (!celulaOcupada) {
                                  setCelulaEmEdicao(null)
                                }
                              }}
                              autoFocus
                            >
                              {OPCOES_CODIGO_JORNADA.map((opcao) => (
                                <option key={opcao.valor} value={opcao.valor}>
                                  {opcao.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCelulaEmEdicao(chaveCelula)}
                              className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold hover:brightness-95 ${statusNoDia.classe}`}
                            >
                              {statusNoDia.texto}
                            </button>
                          )}

                          {viagensNoDia.length > 0 ? (
                            <div className="space-y-1">
                              {viagensNoDia.map((viagem) => (
                                <Link
                                  key={viagem.id}
                                  href={`/viagens/editar/${viagem.id}`}
                                  className="block rounded-md border border-blue-200 bg-blue-50 p-1 text-xs hover:bg-blue-100"
                                >
                                  <div className="font-semibold text-blue-900">{viagem.numViagem}</div>
                                </Link>
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
  )
}
