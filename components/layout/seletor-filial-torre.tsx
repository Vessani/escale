"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { selecionarFilialTorre } from "@/lib/actions/torre"
import { chamarAcao } from "@/lib/chamar-acao"

export type DadosTorre = {
  filiais: Array<{ id: number; nome: string }>
  filialId: number | null
}

/** Faixa no topo das telas da torre: qual filial ela está vendo, e que ali é só consulta. */
export function SeletorFilialTorre({ filiais, filialId }: DadosTorre) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")

  const trocar = (valor: string) => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => selecionarFilialTorre(Number(valor)))
      if (!resposta.sucesso) return setErro(resposta.erro ?? "Não foi possível trocar de filial.")
      router.refresh()
    })
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Eye aria-hidden className="size-4 text-muted-foreground" />
        Torre · só consulta
      </span>
      <Select value={filialId ? String(filialId) : ""} onValueChange={trocar} disabled={pendente}>
        <SelectTrigger aria-label="Filial" className="h-8 w-56">
          <SelectValue placeholder="Selecione a filial" />
        </SelectTrigger>
        <SelectContent>
          {filiais.map((filial) => (
            <SelectItem key={filial.id} value={String(filial.id)}>
              {filial.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {erro && <span className="text-sm text-destructive">{erro}</span>}
    </div>
  )
}
