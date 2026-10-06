"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { trocarMotorista } from "@/lib/actions/troca-motorista"
import { passarViagem } from "@/lib/actions/minhas-viagens"
import { chamarAcao } from "@/lib/chamar-acao"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { TAMANHO_MAXIMO_LOCAL, TAMANHO_MAXIMO_MOTIVO_TROCA } from "@/lib/validation/troca-motorista"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"
import { formatDateTimeForInput } from "@/lib/utils/date-format"

const MOTIVOS_SUGERIDOS = ["Estouro de jornada", "Revezamento / escala", "Problema de saúde", "Problema mecânico", "Questão pessoal"]

/**
 * Troca de motorista no meio da viagem. `modo="motorista"`: o próprio
 * motorista passa a viagem (e volta pra lista dele, porque deixa de ser
 * dele); `modo="escalador"`: troca feita pelo escritório.
 */
export function FormTrocaMotorista({
  viagemId,
  numViagem,
  substitutos,
  kmInicial,
  modo,
  agoraServidor,
  aoCancelar,
}: {
  viagemId: number
  numViagem: string
  substitutos: Array<{ id: number; nome: string }>
  kmInicial: number | null
  modo: "escalador" | "motorista"
  /** Relógio do servidor: o campo abre na hora atual de Brasília, não na do aparelho. */
  agoraServidor: string
  aoCancelar?: () => void
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [confirmar, setConfirmar] = useState(false)
  const [substitutoId, setSubstitutoId] = useState("")
  const [km, setKm] = useState("")
  const [quando, setQuando] = useState(() => formatDateTimeForInput(agoraServidor))
  const [local, setLocal] = useState("")
  const [motivo, setMotivo] = useState("")

  const grande = modo === "motorista"
  const campo = cn("text-foreground", grande ? "h-11 text-base" : "h-9 text-sm")
  const nomeSubstituto = substitutos.find((s) => String(s.id) === substitutoId)?.nome
  const completo = substitutoId && km && quando && local.trim() && motivo.trim()

  const enviar = () => {
    setErro("")
    const dados = { motoristaNovoId: Number(substitutoId), km: Number(km), trocadoEm: quando, local, motivo }
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => (modo === "motorista" ? passarViagem(viagemId, dados) : trocarMotorista(viagemId, dados)))
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      setConfirmar(false)
      if (modo === "motorista") router.push(AREA_MOTORISTA)
      else {
        aoCancelar?.()
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {erro && !confirmar && <Alert variant="error">{erro}</Alert>}
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Motorista que assume
        <select
          value={substitutoId}
          onChange={(e) => setSubstitutoId(e.target.value)}
          className={cn("rounded-md border border-input bg-background px-2", campo)}
        >
          <option value="">Escolha o motorista</option>
          {substitutos.map((s) => (
            <option key={s.id} value={s.id}>
              {formatarNomeProprio(s.nome)}
            </option>
          ))}
        </select>
      </label>
      <div className={cn("grid gap-2", !grande && "sm:grid-cols-2")}>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Km na troca
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder={kmInicial !== null ? `≥ ${kmInicial}` : undefined}
            value={km}
            onChange={(e) => setKm(e.target.value.replace(/\D/g, "").slice(0, 7))}
            className={cn("tabular-nums", campo)}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Data e hora da troca
          <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className={campo} />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Local
        <Input
          placeholder="Ex: Posto Graal, BR-116 km 140 — Curitiba/PR"
          maxLength={TAMANHO_MAXIMO_LOCAL}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className={campo}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        Motivo
        <Input
          list={`motivos-troca-${viagemId}`}
          placeholder="Escolha ou escreva"
          maxLength={TAMANHO_MAXIMO_MOTIVO_TROCA}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={campo}
        />
        <datalist id={`motivos-troca-${viagemId}`}>
          {MOTIVOS_SUGERIDOS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <div className="flex gap-2">
        {aoCancelar && (
          <Button type="button" variant="ghost" className={grande ? "h-12" : undefined} onClick={aoCancelar} disabled={pendente}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          className={cn("flex-1", grande && "h-12 text-base")}
          disabled={pendente || !completo}
          onClick={() => setConfirmar(true)}
        >
          {modo === "motorista" ? "Passar a viagem" : "Trocar motorista"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={`Passar a viagem ${numViagem} para ${nomeSubstituto ? formatarNomeProprio(nomeSubstituto) : "o substituto"}?`}
        description={
          modo === "motorista"
            ? "Ela sai do seu celular e vai pro dele, que continua registrando as chegadas, as despesas e o km final."
            : "A viagem passa pro acesso do novo motorista; o anterior deixa de ver ela."
        }
        confirmLabel="Confirmar troca"
        confirmingLabel="Trocando..."
        destructive={false}
        confirming={pendente}
        erro={confirmar ? erro || null : null}
        onConfirm={enviar}
      />
    </div>
  )
}
