"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { BotaoIcone } from "@/components/ui/botao-icone"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { deletarViagem } from "@/lib/actions/viagens"
import { chamarAcao } from "@/lib/chamar-acao"

type Props = {
  viagemId: number
  numeroViagem: string
}

export default function ExcluirViagemButton({ viagemId, numeroViagem }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogAberto, setDialogAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleExcluir = () => {
    setErro(null)

    startTransition(async () => {
      const resposta = await chamarAcao(() => deletarViagem(viagemId))
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível excluir a viagem.")
        return
      }

      setDialogAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <BotaoIcone
        rotulo="Excluir viagem"
        icone={Trash2}
        perigo
        onClick={() => {
          setErro(null)
          setDialogAberto(true)
        }}
      />

      <ConfirmDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        title="Excluir viagem"
        description={`Tem certeza que deseja excluir a viagem ${numeroViagem}? Essa ação não pode ser desfeita pelo sistema.`}
        confirming={isPending}
        erro={erro}
        onConfirm={handleExcluir}
      />
    </>
  )
}
