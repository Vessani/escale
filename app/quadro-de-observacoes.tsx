"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { createPortal } from "react-dom"
import { ClipboardList, Pencil, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { atualizarObservacoes } from "@/lib/actions/quadro"
import { chamarAcao } from "@/lib/chamar-acao"

/** Onde o recado/editor aparece (acima dos contadores do Dashboard). */
export const ID_SLOT_QUADRO = "slot-quadro-observacoes"

const semAssinatura = () => () => {}

/**
 * Recado geral da operação (frota com problema, indo pra oficina...), bloco
 * único e compartilhado, sem histórico. Não ocupa tela à toa: sem recado é
 * só o botão "+ Observação"; com recado vira uma faixa fina acima dos
 * contadores (no modo TV, que mostra só as viagens, não aparece).
 */
export default function QuadroDeObservacoes({ textoInicial }: { textoInicial: string }) {
  const [pendente, iniciarTransicao] = useTransition()
  const [salvo, setSalvo] = useState(textoInicial.trim())
  const [rascunho, setRascunho] = useState(textoInicial)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState("")
  // O lugar do recado só existe no navegador (no servidor, null → nada é desenhado ali).
  const slot = useSyncExternalStore(
    semAssinatura,
    () => document.getElementById(ID_SLOT_QUADRO),
    () => null,
  )

  const gravar = (texto: string) => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => atualizarObservacoes(texto))
      if (!resposta.sucesso) return setErro(resposta.erro ?? "Não foi possível salvar o recado.")
      setSalvo(texto.trim())
      setRascunho(texto.trim())
      setEditando(false)
    })
  }

  const abrir = () => {
    setRascunho(salvo)
    setEditando(true)
  }

  const conteudo = editando ? (
    <section className="space-y-2 rounded-lg border bg-card p-3 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardList className="size-4 text-muted-foreground" aria-hidden /> Recado pra operação
      </p>
      <Textarea
        autoFocus
        className="min-h-20"
        placeholder="Ex.: Frota 2064/908 com problema no freio, não alocar até revisão."
        value={rascunho}
        disabled={pendente}
        onChange={(evento) => setRascunho(evento.target.value)}
      />
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => setEditando(false)}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={pendente} onClick={() => gravar(rascunho)}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </section>
  ) : salvo ? (
    <section className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
      <ClipboardList className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="flex-1 whitespace-pre-line text-foreground">{salvo}</p>
      <span className="fora-do-modo-tv flex shrink-0 items-center">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar recado" onClick={abrir} disabled={pendente}>
          <Pencil className="size-4 text-muted-foreground" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Apagar recado" onClick={() => gravar("")} disabled={pendente}>
          <X className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </span>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </section>
  ) : null

  return (
    <>
      {!salvo && !editando && (
        <Button type="button" variant="outline" size="sm" className="fora-do-modo-tv" onClick={abrir}>
          <Plus className="mr-2 size-4" aria-hidden />
          Observação
        </Button>
      )}
      {slot && conteudo && createPortal(conteudo, slot)}
    </>
  )
}
