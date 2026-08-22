"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { atualizarJornadaMotoristaNoCalendario } from "@/lib/actions/motoristas"
import { obterStatusJornada } from "@/lib/services/jornada.service"
import type { AcaoSugerida } from "@/lib/services/motoristas-ociosos.service"
import { classeBadgeTurno } from "../../viagens/badge-styles"
import { classeBadgeJornada } from "../jornada-status"

type MotoristaSemViagem = {
  id: number
  nome: string
  seva: number
  turno: "MANHA" | "NOITE"
  liberado: boolean
  codigoHoje: number
  acao: AcaoSugerida
}

type Props = {
  motoristas: MotoristaSemViagem[]
  /** Dia de referência no formato YYYY-MM-DD, pra registrar a jornada no dia certo. */
  dataReferencia: string
}

export default function SemViagemClient({ motoristas, dataReferencia }: Props) {
  const router = useRouter()
  const [motoristaSalvando, setMotoristaSalvando] = useState<number | null>(null)
  const [mensagemErro, setMensagemErro] = useState("")
  const [isPending, startTransition] = useTransition()

  const { acionaveis, semAcao } = useMemo(() => {
    const acionaveis = motoristas.filter((motorista) => motorista.acao.tipo !== "NENHUMA")
    const semAcao = motoristas.filter((motorista) => motorista.acao.tipo === "NENHUMA")
    return { acionaveis, semAcao }
  }, [motoristas])

  const aplicarAcao = (motoristaId: number, codigoNoDia: number) => {
    setMotoristaSalvando(motoristaId)
    setMensagemErro("")

    startTransition(async () => {
      const resposta = await atualizarJornadaMotoristaNoCalendario(motoristaId, dataReferencia, codigoNoDia)
      setMotoristaSalvando(null)

      if (!resposta.sucesso) {
        setMensagemErro(resposta.erro ?? "Não foi possível atualizar a jornada.")
        return
      }

      router.refresh()
    })
  }

  const renderLinhas = (lista: MotoristaSemViagem[]) =>
    lista.map((motorista) => {
      const statusJornada = obterStatusJornada(motorista.codigoHoje)
      const salvando = motoristaSalvando === motorista.id

      return (
        <TableRow key={motorista.id}>
          <TableCell>
            <Link href={`/motorista/editar/${motorista.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
              {motorista.nome}
            </Link>
          </TableCell>
          <TableCell className="text-slate-500">SEVA {motorista.seva}</TableCell>
          <TableCell>
            <Badge variant="outline" className={classeBadgeTurno(motorista.turno)}>
              {motorista.turno}
            </Badge>
          </TableCell>
          <TableCell>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${classeBadgeJornada(motorista.codigoHoje)}`}>
              {statusJornada.texto}
            </span>
            {!motorista.liberado && (
              <Badge variant="warning" className="ml-2">
                Em treinamento
              </Badge>
            )}
          </TableCell>
          <TableCell className="max-w-xs whitespace-normal text-slate-600">{motorista.acao.texto}</TableCell>
          <TableCell>
            {motorista.acao.tipo === "DAR_FOLGA" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={salvando || isPending} onClick={() => aplicarAcao(motorista.id, 7)}>
                  {salvando ? "Salvando..." : "Dar folga hoje"}
                </Button>
                <Button size="sm" variant="outline" disabled={salvando || isPending} onClick={() => aplicarAcao(motorista.id, 10)}>
                  Marcar como Interno
                </Button>
                <Button size="sm" variant="outline" disabled={salvando || isPending} onClick={() => aplicarAcao(motorista.id, 11)}>
                  Marcar como Manutenção
                </Button>
              </div>
            )}
            {motorista.acao.tipo === "REVISAR_INTERNO" && (
              <Button size="sm" variant="outline" disabled={salvando || isPending} onClick={() => aplicarAcao(motorista.id, 1)}>
                {salvando ? "Salvando..." : "Tirar de Interno"}
              </Button>
            )}
            {motorista.acao.tipo === "REVISAR_MANUTENCAO" && (
              <Button size="sm" variant="outline" disabled={salvando || isPending} onClick={() => aplicarAcao(motorista.id, 1)}>
                {salvando ? "Salvando..." : "Tirar de Manutenção"}
              </Button>
            )}
            {motorista.acao.tipo === "NENHUMA" && (
              <Link href={`/motorista/editar/${motorista.id}`}>
                <Button size="sm" variant="ghost">
                  Ver no calendário
                </Button>
              </Link>
            )}
          </TableCell>
        </TableRow>
      )
    })

  return (
    <div className="space-y-6">
      {mensagemErro ? <p className="text-sm text-destructive">{mensagemErro}</p> : null}

      {acionaveis.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Precisam de revisão ({acionaveis.length})</h2>
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Status hoje</TableHead>
                  <TableHead>Sugestão</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderLinhas(acionaveis)}</TableBody>
            </Table>
          </div>
        </div>
      )}

      {semAcao.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">Sem ação necessária ({semAcao.length})</h2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Status hoje</TableHead>
                  <TableHead>Sugestão</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderLinhas(semAcao)}</TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
