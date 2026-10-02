"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { BotaoIcone } from "@/components/ui/botao-icone"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { apagarChegada } from "@/lib/actions/correcao-registro"
import { chamarAcao } from "@/lib/chamar-acao"

/** Escalador apaga uma chegada registrada no cliente errado — depois a entrega pode ser editada. */
export function ApagarChegadaBotao({ chegadaId, cliente }: { chegadaId: number; cliente: string }) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const confirmar = () => {
    setErro(null)
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => apagarChegada(chegadaId))
      if (!resposta.sucesso) return setErro(resposta.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <BotaoIcone rotulo={`Apagar chegada em ${cliente}`} icone={Trash2} perigo onClick={() => setAberto(true)} />
      <ConfirmDialog
        open={aberto}
        onOpenChange={setAberto}
        title={`Apagar a chegada em ${cliente}?`}
        description="Use quando a chegada foi registrada no cliente errado. O km, a hora e a medição saem da viagem (ficam no histórico) e a entrega volta a poder ser editada. O motorista pode registrar de novo."
        confirmLabel="Apagar chegada"
        confirmingLabel="Apagando..."
        confirming={pendente}
        erro={erro}
        onConfirm={confirmar}
      />
    </>
  )
}
