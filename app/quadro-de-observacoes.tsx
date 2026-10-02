"use client"

import { useState, useTransition } from "react"
import { ClipboardList } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { atualizarObservacoes } from "@/lib/actions/quadro"
import { chamarAcao } from "@/lib/chamar-acao"

type Props = {
  textoInicial: string
}

/** Recado geral da operação (frota com problema, indo pra oficina, etc.) — bloco único e compartilhado, sem histórico. */
export default function QuadroDeObservacoes({ textoInicial }: Props) {
  const [isPending, startTransition] = useTransition()
  const [texto, setTexto] = useState(textoInicial)
  const [erro, setErro] = useState("")
  const [salvo, setSalvo] = useState(true)

  const salvar = () => {
    setErro("")
    startTransition(async () => {
      const resposta = await chamarAcao(() => atualizarObservacoes(texto))
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível salvar as observações.")
        return
      }
      setSalvo(true)
    })
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm p-4 space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Quadro de observações</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Recados gerais da operação: frota com problema, indo pra oficina, etc. Visível pra todo mundo, sem histórico — o texto atual é sempre o mais recente.
      </p>
      <Textarea
        className="min-h-24"
        placeholder="Ex.: Frota 2064/908 com problema no freio, não alocar até revisão."
        value={texto}
        disabled={isPending}
        onChange={(evento) => {
          setTexto(evento.target.value)
          setSalvo(false)
        }}
        onBlur={salvar}
      />
      <div className="text-[11px]">
        {erro ? (
          <p className="text-destructive">{erro}</p>
        ) : isPending ? (
          <p className="text-muted-foreground">Salvando...</p>
        ) : salvo ? (
          <p className="text-muted-foreground">Salvo.</p>
        ) : (
          <p className="text-muted-foreground">Alterações não salvas — clique fora do campo pra salvar.</p>
        )}
      </div>
    </section>
  )
}
