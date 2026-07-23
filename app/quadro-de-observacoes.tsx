"use client"

import { useState, useTransition } from "react"
import { ClipboardList } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { atualizarObservacoes } from "@/lib/actions/quadro"

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
      const resposta = await atualizarObservacoes(texto)
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Erro ao salvar observações.")
        return
      }
      setSalvo(true)
    })
  }

  return (
    <section className="rounded-lg border bg-white shadow-sm p-4 space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900">Quadro de observações</h2>
      </div>
      <p className="text-xs text-slate-500">
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
          <p className="text-slate-400">Salvando...</p>
        ) : salvo ? (
          <p className="text-slate-400">Salvo.</p>
        ) : (
          <p className="text-slate-400">Alterações não salvas — clique fora do campo pra salvar.</p>
        )}
      </div>
    </section>
  )
}
