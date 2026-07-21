"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { atualizarSaidaReal } from "@/lib/actions/viagens"
import { formatDateTimeForInput } from "@/lib/utils/date-format"

type Props = {
  viagemId: number
  inicioPrevisto: string | Date
  horarioRealSaidaInicial: string | Date | null
  motivoAtrasoInicial: string | null
}

/** Edição inline pelo dashboard — ver buscarViagensDoDashboard (lib/queries/viagens.ts). */
export default function AtualizarSaidaReal({
  viagemId,
  inicioPrevisto,
  horarioRealSaidaInicial,
  motivoAtrasoInicial,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState("")
  const [horarioRealSaida, setHorarioRealSaida] = useState(
    horarioRealSaidaInicial ? formatDateTimeForInput(horarioRealSaidaInicial) : "",
  )
  const [motivoAtraso, setMotivoAtraso] = useState(motivoAtrasoInicial ?? "")

  const atrasado = Boolean(horarioRealSaida) && new Date(horarioRealSaida) > new Date(inicioPrevisto)

  const salvar = (proximoHorario: string, proximoMotivo: string) => {
    setErro("")
    startTransition(async () => {
      const resposta = await atualizarSaidaReal(viagemId, {
        horarioRealSaida: proximoHorario || null,
        motivoAtraso: proximoMotivo || null,
      })
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Erro ao salvar.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <Input
        type="datetime-local"
        className="h-8 bg-white text-xs"
        value={horarioRealSaida}
        disabled={isPending}
        onChange={(e) => setHorarioRealSaida(e.target.value)}
        onBlur={() => salvar(horarioRealSaida, motivoAtraso)}
      />
      <div className="flex items-center gap-1">
        {atrasado && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-700" />}
        <Input
          placeholder="Motivo do atraso / observações"
          className={atrasado ? "h-7 border-amber-300 bg-amber-50 text-xs" : "h-7 bg-white text-xs"}
          value={motivoAtraso}
          disabled={isPending}
          onChange={(e) => setMotivoAtraso(e.target.value)}
          onBlur={() => salvar(horarioRealSaida, motivoAtraso)}
        />
      </div>
      {erro ? <p className="text-[11px] text-red-600">{erro}</p> : null}
    </div>
  )
}
