"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Wrench } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { informarProblema } from "@/lib/actions/minhas-viagens"
import { chamarAcao } from "@/lib/chamar-acao"
import { formatarHoraLocal } from "@/lib/utils/date-format"
import { TAMANHO_MAXIMO_PROBLEMA } from "@/lib/services/limites-registro"

/** Problema mecânico: o que ele escrever aparece em vermelho pro escalador. "Resolvido" limpa. */
export function ProblemaMecanico({
  viagemId,
  problema,
  informadoEm,
}: {
  viagemId: number
  problema: string | null
  informadoEm: string | null
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(problema ?? "")

  const salvar = (valor: string) => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => informarProblema(viagemId, valor))
      if (!resposta.sucesso) return setErro(resposta.erro)
      setEditando(false)
      if (!valor) setTexto("")
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Wrench className="size-5 text-primary" aria-hidden />
        Problema mecânico
      </h2>
      {erro && <Alert variant="error">{erro}</Alert>}

      {problema && !editando ? (
        <>
          <Alert variant="error">
            {problema}
            {informadoEm && (
              <span className="block text-xs opacity-80">Informado às {formatarHoraLocal(informadoEm)} — o escalador está vendo.</span>
            )}
          </Alert>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setEditando(true)} disabled={pendente}>
              Editar
            </Button>
            <Button type="button" className="h-11 flex-1" onClick={() => salvar("")} disabled={pendente}>
              {pendente ? "Salvando..." : "Resolvido"}
            </Button>
          </div>
        </>
      ) : !editando ? (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setEditando(true)}>
          Informar problema
        </Button>
      ) : (
        <>
          <Textarea
            value={texto}
            maxLength={TAMANHO_MAXIMO_PROBLEMA}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex: pneu furado na BR-101, aguardando socorro"
            className="min-h-24 resize-none text-base"
          />
          <p className="text-right text-xs tabular-nums text-muted-foreground">
            {texto.length}/{TAMANHO_MAXIMO_PROBLEMA}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                setEditando(false)
                setTexto(problema ?? "")
              }}
              disabled={pendente}
            >
              Cancelar
            </Button>
            <Button type="button" className="h-11 flex-1" onClick={() => salvar(texto)} disabled={pendente || !texto.trim()}>
              {pendente ? "Enviando..." : "Avisar o escalador"}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
