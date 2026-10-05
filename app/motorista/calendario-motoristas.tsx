"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { atualizarJornadaMotoristaNoCalendario, deletarMotorista } from "@/lib/actions/motoristas"
import { calcularDiasDisponiveis } from "@/lib/services/alocacao.service"
import { completarFolgasDoRelatorio, mapearRegistrosJornada, obterStatusJornada, projetarCodigoNoDia } from "@/lib/services/jornada.service"
import { colunaDateParaLocal, fimDoDia, formatarHoraLocal, inicioDoDia } from "@/lib/utils/date-format"
import { classeBadgeTurno } from "../viagens/badge-styles"
import {
  formatarSemana,
  OPCOES_CODIGO_JORNADA,
  OPCOES_FILTRO_STATUS,
  statusJornadaCorrespondeAoFiltro,
  type FiltroStatusJornada,
} from "./calendario-utils"
import { classeBadgeJornada } from "./jornada-status"
import type { TipoMotorista } from "@prisma/client"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { Pencil, Trash2 } from "lucide-react"
import { chamarAcao } from "@/lib/chamar-acao"

type Viagem = {
  id: number
  numViagem: string
  inicioPrevisto: string
  fimPrevisto: string
}

type RegistroJornada = {
  data: string
  codigo: number
  /** Horário real daquele dia — só o import do Relatório de Jornada preenche; dias só projetados/editados manualmente vêm null. */
  inicioJornada: string | null
  fimJornada: string | null
}

/** Jornada real (não projetada) de um dia exato — null se aquele dia não tem uma linha real importada, ou tem mas sem horário. */
function buscarJornadaRealNoDia(registros: RegistroJornada[], dia: Date) {
  const alvo = inicioDoDia(dia).getTime()
  const registro = registros.find((r) => colunaDateParaLocal(new Date(r.data)).getTime() === alvo)

  if (!registro?.inicioJornada || !registro?.fimJornada) {
    return null
  }

  return { inicioJornada: registro.inicioJornada, fimJornada: registro.fimJornada }
}

/** Horário da viagem dentro de um dia: "07:00–19:18", "07:00 →" (continua), "→ 19:18" (termina) ou "dia todo". */
function horarioDaViagemNoDia(viagem: Viagem, dia: Date) {
  const inicio = new Date(viagem.inicioPrevisto)
  const fim = new Date(viagem.fimPrevisto)
  const comecaNoDia = inicio >= inicioDoDia(dia)
  const terminaNoDia = fim <= fimDoDia(dia)
  if (comecaNoDia && terminaNoDia) return `${formatarHoraLocal(inicio)}–${formatarHoraLocal(fim)}`
  if (comecaNoDia) return `${formatarHoraLocal(inicio)} →`
  if (terminaNoDia) return `→ ${formatarHoraLocal(fim)}`
  return "dia todo"
}

type Motorista = {
  id: number
  nome: string
  turno: "MANHA" | "NOITE"
  seva: number
  diasTrabalhados: number
  tipo: TipoMotorista
  viagens: Viagem[]
  registrosJornada: RegistroJornada[]
}

type Props = {
  inicioParam: string
  hojeIso: string
  /** Até que dia o Relatório de Jornada cobre — dia coberto sem registro conta como folga. */
  relatorioJornadaAteIso: string | null
  dias: string[]
  motoristas: Motorista[]
  podeExcluir: boolean
}

export default function CalendarioMotoristas({ inicioParam, hojeIso, relatorioJornadaAteIso, dias, motoristas, podeExcluir }: Props) {
  const router = useRouter()
  const [celulaEmEdicao, setCelulaEmEdicao] = useState<string | null>(null)
  const [celulaSalvando, setCelulaSalvando] = useState<string | null>(null)
  const [motoristaParaExcluir, setMotoristaParaExcluir] = useState<{ id: number; nome: string } | null>(null)
  const [motoristaExcluindoId, setMotoristaExcluindoId] = useState<number | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [mensagemErro, setMensagemErro] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusJornada>("TODOS")
  const [isPending, startTransition] = useTransition()

  const hoje = useMemo(() => new Date(hojeIso), [hojeIso])

  // Código de hoje projetado a partir do histórico real (mesma conta que a
  // coluna "Hoje" da grade usa) — não o cache motorista.diasTrabalhados, que só
  // é atualizado quando algo escreve explicitamente no dia de hoje e por isso
  // pode ficar parado enquanto os dias passam sem nenhum evento.
  const motoristasComHoje = useMemo(
    () =>
      motoristas.map((motorista) => {
        // registrosProjetados alimenta só a projeção/rotação (projetarCodigoNoDia);
        // motorista.registrosJornada (bruto, preservado pelo spread) é usado à parte
        // pra achar o horário real de um dia exato — ver buscarJornadaRealNoDia.
        const registrosProjetados = completarFolgasDoRelatorio(
          mapearRegistrosJornada(motorista.registrosJornada),
          relatorioJornadaAteIso ? new Date(relatorioJornadaAteIso) : null,
        )
        const codigoHoje = projetarCodigoNoDia(registrosProjetados, hoje, hoje, motorista.diasTrabalhados)
        return { ...motorista, registrosProjetados, codigoHoje }
      }),
    [motoristas, hoje, relatorioJornadaAteIso],
  )

  const motoristasFiltrados = useMemo(
    () => motoristasComHoje.filter((motorista) => statusJornadaCorrespondeAoFiltro(motorista.codigoHoje, filtroStatus)),
    [motoristasComHoje, filtroStatus],
  )

  const salvarJornada = (motoristaId: number, diaIso: string, codigoNoDia: number) => {
    const chaveCelula = `${motoristaId}-${diaIso}`
    setCelulaSalvando(chaveCelula)
    setMensagemErro("")

    startTransition(async () => {
      const resposta = await chamarAcao(() => atualizarJornadaMotoristaNoCalendario(motoristaId, diaIso, codigoNoDia))
      setCelulaSalvando(null)
      setCelulaEmEdicao(null)

      if (!resposta.sucesso) {
        setMensagemErro(resposta.erro ?? "Não foi possível atualizar a jornada.")
        return
      }

      router.replace(`/motorista?inicio=${inicioParam}`)
      router.refresh()
    })
  }

  const confirmarExclusaoMotorista = () => {
    if (!motoristaParaExcluir) return
    const motoristaId = motoristaParaExcluir.id

    setErroExclusao(null)
    setMotoristaExcluindoId(motoristaId)

    startTransition(async () => {
      const resposta = await chamarAcao(() => deletarMotorista(motoristaId))
      setMotoristaExcluindoId(null)

      if (!resposta.sucesso) {
        setErroExclusao(resposta.erro ?? "Não foi possível excluir o motorista.")
        return
      }

      setMotoristaParaExcluir(null)
      router.replace(`/motorista?inicio=${inicioParam}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-foreground/80">Filtro por status:</span>
        {OPCOES_FILTRO_STATUS.map((opcao) => {
          const ativo = filtroStatus === opcao.valor
          return (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setFiltroStatus(opcao.valor)}
              className={`rounded px-2 py-0.5 font-semibold transition ${opcao.classe} ${ativo ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
            >
              {opcao.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Clique no status de qualquer célula para abrir o seletor e salvar imediatamente.
      </p>
      {mensagemErro ? <p className="text-sm text-destructive">{mensagemErro}</p> : null}

      {motoristasFiltrados.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-sm text-foreground/80">
          Nenhum motorista encontrado para o filtro selecionado.
        </div>
      ) : (
        <div className="isolate overflow-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[960px] table-fixed text-sm">
          <colgroup>
            <col className="w-72" />
            {dias.map((diaIso) => (
              <col key={diaIso} />
            ))}
          </colgroup>
          <thead className="bg-muted">
            <tr>
              <th className="sticky left-0 z-40 bg-muted border-b border-r px-4 py-3 text-left font-semibold text-foreground/80 shadow-[4px_0_6px_-4px_rgba(15,23,42,0.2)]">
                Motorista
              </th>
              {dias.map((diaIso) => {
                const dia = new Date(`${diaIso}T00:00:00`)
                const ehHoje = inicioDoDia(dia).getTime() === inicioDoDia(hoje).getTime()
                return (
                  <th
                    key={diaIso}
                    className={`border-b border-r px-2 py-2.5 text-center align-middle ${ehHoje ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <div className={`text-sm font-semibold tabular-nums ${ehHoje ? "text-primary" : "text-foreground/80"}`}>
                      {String(dia.getDate()).padStart(2, "0")}/{String(dia.getMonth() + 1).padStart(2, "0")}
                    </div>
                    <div className={`text-[11px] uppercase ${ehHoje ? "font-bold text-primary" : "text-muted-foreground"}`}>
                      {ehHoje ? "Hoje" : formatarSemana(dia).replace(".", "")}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {motoristasFiltrados.map((motorista, indiceMotorista) => {
              const diasDisponiveis = calcularDiasDisponiveis(motorista.codigoHoje)
              const statusJornada = obterStatusJornada(motorista.codigoHoje)
              const fundoColunaFixa = indiceMotorista % 2 === 0 ? "bg-card" : "bg-muted"
              const registrosProjetados = motorista.registrosProjetados
              const registrosJornadaBrutos = motorista.registrosJornada
              const classeTurnoBadge = classeBadgeTurno(motorista.turno)

              return (
                <tr key={motorista.id} className="odd:bg-card even:bg-muted/40">
                  <td className={`sticky left-0 z-30 ${fundoColunaFixa} border-r border-b px-4 py-3 align-top shadow-[4px_0_6px_-4px_rgba(15,23,42,0.15)]`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/motorista/editar/${motorista.id}`} className="min-w-0 font-semibold text-foreground hover:text-primary">
                          <NomeMotorista nome={motorista.nome} tipo={motorista.tipo} />
                        </Link>
                        <div className="flex shrink-0 items-center gap-1">
                          <AcoesLinha>
                            <BotaoIcone href={`/motorista/editar/${motorista.id}`} rotulo="Editar motorista" icone={Pencil} />
                            {podeExcluir && (
                              <BotaoIcone
                                rotulo={motoristaExcluindoId === motorista.id ? "Excluindo..." : "Excluir motorista"}
                                icone={Trash2}
                                perigo
                                disabled={isPending}
                                onClick={() => {
                                  setErroExclusao(null)
                                  setMotoristaParaExcluir({ id: motorista.id, nome: motorista.nome })
                                }}
                              />
                            )}
                          </AcoesLinha>
                          <Badge variant="outline" className={classeTurnoBadge}>
                            {motorista.turno === "NOITE" ? "Noite" : "Dia"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>SEVA <span className="font-mono tabular-nums">{motorista.seva}</span></span>
                        <span>·</span>
                        <span className="tabular-nums">{diasDisponiveis} dia(s) disponível(is)</span>
                      </div>
                      <span className={`inline-block w-fit rounded px-2 py-0.5 text-xs font-semibold ${classeBadgeJornada(motorista.codigoHoje)}`}>
                        Hoje: {statusJornada.texto}
                      </span>
                    </div>
                  </td>

                  {dias.map((diaIso) => {
                    const chaveCelula = `${motorista.id}-${diaIso}`
                    const dia = new Date(`${diaIso}T00:00:00`)
                    const ehHoje = inicioDoDia(dia).getTime() === inicioDoDia(hoje).getTime()
                    const codigoNoDia = projetarCodigoNoDia(registrosProjetados, dia, hoje, motorista.diasTrabalhados)
                    const statusNoDia = obterStatusJornada(codigoNoDia)
                    const jornadaReal = buscarJornadaRealNoDia(registrosJornadaBrutos, dia)
                    const celulaAberta = celulaEmEdicao === chaveCelula
                    const celulaOcupada = celulaSalvando === chaveCelula

                    const viagensNoDia = motorista.viagens.filter((viagem) => {
                      const inicio = new Date(viagem.inicioPrevisto)
                      const fim = new Date(viagem.fimPrevisto)
                      return inicio <= fimDoDia(dia) && fim >= inicioDoDia(dia)
                    })

                    return (
                      <td
                        key={chaveCelula}
                        className={`border-r border-b px-2 py-2 align-top ${celulaAberta ? "relative z-10" : ""} ${ehHoje ? "bg-primary/5" : ""}`}
                      >
                        {/* Três faixas de altura fixa (status, horário da jornada, viagens): tudo alinhado entre as colunas. */}
                        <div className="flex flex-col items-stretch gap-1.5">
                          <div className="flex h-6 items-center justify-center">
                            {celulaAberta ? (
                              <select
                                className="w-full rounded border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground"
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
                                title="Clique pra trocar o status do dia"
                                className={`w-full rounded px-2 py-0.5 text-xs font-semibold hover:brightness-95 ${classeBadgeJornada(codigoNoDia)}`}
                              >
                                {statusNoDia.texto}
                              </button>
                            )}
                          </div>

                          <div
                            className="flex h-4 items-center justify-center font-mono text-[11px] tabular-nums text-muted-foreground"
                            title={jornadaReal ? "Jornada real (relatório de jornada)" : undefined}
                          >
                            {jornadaReal ? `${formatarHoraLocal(jornadaReal.inicioJornada)}–${formatarHoraLocal(jornadaReal.fimJornada)}` : ""}
                          </div>

                          <div className="flex min-h-10 flex-col justify-center gap-1">
                            {viagensNoDia.length > 0 ? (
                              viagensNoDia.map((viagem) => (
                                <Link
                                  key={viagem.id}
                                  href={`/viagens/editar/${viagem.id}`}
                                  title={`Viagem ${viagem.numViagem} · ${horarioDaViagemNoDia(viagem, dia)}`}
                                  className="flex flex-col items-center rounded-md border border-primary/20 bg-primary/10 px-1 py-0.5 leading-tight hover:bg-primary/20"
                                >
                                  <span className="font-mono text-xs font-semibold tabular-nums text-primary">{viagem.numViagem}</span>
                                  <span className="font-mono text-[10px] tabular-nums text-primary/80">{horarioDaViagemNoDia(viagem, dia)}</span>
                                </Link>
                              ))
                            ) : (
                              <span className="text-center text-[11px] text-muted-foreground/70">Sem viagem</span>
                            )}
                          </div>
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
      )}

      <ConfirmDialog
        open={motoristaParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setMotoristaParaExcluir(null)
            setErroExclusao(null)
          }
        }}
        title="Excluir motorista"
        description={
          motoristaParaExcluir
            ? `Tem certeza que deseja excluir ${motoristaParaExcluir.nome}? Ele deixa de aparecer nas listagens e na alocação, mas as viagens já registradas com ele continuam no histórico.`
            : ""
        }
        confirming={isPending}
        erro={erroExclusao}
        onConfirm={confirmarExclusaoMotorista}
      />
    </div>
  )
}
