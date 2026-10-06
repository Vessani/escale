"use client"

import { useState } from "react"
import { Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormTrocaMotorista } from "@/components/viagem/form-troca-motorista"

/** No celular: passar a viagem pro motorista que vai continuar. */
export function TrocaMotoristaMotorista({
  viagemId,
  numViagem,
  substitutos,
  kmInicial,
  agoraServidor,
}: {
  viagemId: number
  numViagem: string
  substitutos: Array<{ id: number; nome: string }>
  kmInicial: number | null
  agoraServidor: string
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Repeat className="size-5 text-primary" aria-hidden />
        Troca de motorista
      </h2>
      {aberto ? (
        <FormTrocaMotorista
          viagemId={viagemId}
          numViagem={numViagem}
          substitutos={substitutos}
          kmInicial={kmInicial}
          agoraServidor={agoraServidor}
          modo="motorista"
          aoCancelar={() => setAberto(false)}
        />
      ) : (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setAberto(true)}>
          Passar a viagem para outro motorista
        </Button>
      )}
    </section>
  )
}
