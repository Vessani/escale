"use client"

import { useState } from "react"
import { ArrowRight, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormTrocaMotorista } from "@/components/viagem/form-troca-motorista"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"

type TrocaDaViagem = {
  id: number
  km: number
  trocadoEm: string
  local: string
  motivo: string
  motoristaAnterior: string
  motoristaNovo: string
}

/** Na tela da viagem (escalador): histórico de trocas e, com a viagem em andamento, o botão de trocar. */
export function TrocaMotoristaCard({
  viagemId,
  numViagem,
  emAndamento,
  trocas,
  substitutos,
  kmInicial,
}: {
  viagemId: number
  numViagem: string
  emAndamento: boolean
  trocas: TrocaDaViagem[]
  substitutos: Array<{ id: number; nome: string }>
  kmInicial: number | null
}) {
  const [aberto, setAberto] = useState(false)
  if (!emAndamento && trocas.length === 0) return null

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="bg-muted border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Repeat className="size-5" aria-hidden /> Troca de motorista
        </CardTitle>
        <CardDescription>Quem assumiu a viagem no meio do caminho, onde e por quê.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {trocas.length > 0 && (
          <ol className="divide-y rounded-lg border text-sm">
            {trocas.map((troca) => (
              <li key={troca.id} className="space-y-0.5 px-3 py-2">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  {formatarNomeProprio(troca.motoristaAnterior)}
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                  {formatarNomeProprio(troca.motoristaNovo)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatarDataHoraPtBr(troca.trocadoEm)} · km {troca.km.toLocaleString("pt-BR")} · {troca.local}
                </p>
                <p className="text-xs">Motivo: {troca.motivo}</p>
              </li>
            ))}
          </ol>
        )}
        {emAndamento &&
          (aberto ? (
            <FormTrocaMotorista
              viagemId={viagemId}
              numViagem={numViagem}
              substitutos={substitutos}
              kmInicial={kmInicial}
              modo="escalador"
              aoCancelar={() => setAberto(false)}
            />
          ) : (
            <Button type="button" variant="outline" onClick={() => setAberto(true)}>
              <Repeat className="mr-2 size-4" aria-hidden /> Trocar motorista
            </Button>
          ))}
      </CardContent>
    </Card>
  )
}
