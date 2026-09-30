"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { BotaoIcone } from "@/components/ui/botao-icone"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { deletarCliente } from "@/lib/actions/clientes"

type Props = {
  clienteId: number
  nome: string
}

export default function ExcluirClienteButton({ clienteId, nome }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogAberto, setDialogAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleExcluir = () => {
    setErro(null)

    startTransition(async () => {
      const resposta = await deletarCliente(clienteId)
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível excluir o cliente.")
        return
      }

      setDialogAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <BotaoIcone
        rotulo="Excluir cliente"
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
        title="Excluir cliente"
        description={`Tem certeza que deseja excluir ${nome}? Entregas e integrações que já usam esse nome continuam com o texto, mas ele some das opções do formulário.`}
        confirming={isPending}
        erro={erro}
        onConfirm={handleExcluir}
      />
    </>
  )
}
