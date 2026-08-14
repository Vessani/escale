"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { deletarViagem } from "@/lib/actions/viagens"

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
      const resposta = await deletarViagem(viagemId)
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
      <Button
        variant="outline"
        size="sm"
        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        onClick={() => {
          setErro(null)
          setDialogAberto(true)
        }}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Excluir
      </Button>

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
