"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deletarFrota } from "@/lib/actions/frotas"

type Props = {
  frotaId: number
  cavalo: string
  carreta: string
}

export default function ExcluirFrotaButton({ frotaId, cavalo, carreta }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleExcluir = () => {
    const confirmar = window.confirm(`Tem certeza que deseja excluir o conjunto ${cavalo}/${carreta}?`)

    if (!confirmar) {
      return
    }

    startTransition(async () => {
      const resposta = await deletarFrota(frotaId)
      if (!resposta.sucesso) {
        window.alert(resposta.erro ?? "Não foi possível excluir o conjunto.")
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
