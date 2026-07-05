"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deletarViagem } from "@/lib/actions/viagens"

type Props = {
  viagemId: number
  numeroViagem: string
}

export default function ExcluirViagemButton({ viagemId, numeroViagem }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleExcluir = () => {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir a viagem ${numeroViagem}? Esta ação pode ser desfeita apenas no banco.`,
    )

    if (!confirmar) {
      return
    }

    startTransition(async () => {
      const resposta = await deletarViagem(viagemId)
      if (!resposta.sucesso) {
        window.alert(resposta.erro ?? "Não foi possível excluir a viagem.")
        return
      }

      router.refresh()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
      disabled={isPending}
      onClick={handleExcluir}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {isPending ? "Excluindo..." : "Excluir"}
    </Button>
  )
}
