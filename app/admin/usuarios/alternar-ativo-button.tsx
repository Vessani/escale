"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserCheck, UserX } from "lucide-react"
import { BotaoIcone } from "@/components/ui/botao-icone"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { alterarUsuarioAtivo } from "@/lib/actions/usuarios"

type Props = {
  usuarioId: string
  nome: string
  ativo: boolean
}

export default function AlternarAtivoButton({ usuarioId, nome, ativo }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogAberto, setDialogAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const confirmar = () => {
    setErro(null)
    startTransition(async () => {
      const resposta = await alterarUsuarioAtivo(usuarioId, !ativo)
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      setDialogAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <BotaoIcone
        rotulo={ativo ? "Desativar usuário" : "Reativar usuário"}
        icone={ativo ? UserX : UserCheck}
        perigo={ativo}
        onClick={() => {
          setErro(null)
          setDialogAberto(true)
        }}
      />

      <ConfirmDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        title={ativo ? "Desativar usuário" : "Reativar usuário"}
        description={
          ativo
            ? `${nome} não vai mais conseguir entrar, e se estiver usando o sistema agora será desconectado no próximo clique. Dá pra reativar depois.`
            : `${nome} volta a poder entrar com a mesma senha de antes.`
        }
        confirmLabel={ativo ? "Desativar" : "Reativar"}
        confirmingLabel="Salvando..."
        destructive={ativo}
        confirming={isPending}
        erro={erro}
        onConfirm={confirmar}
      />
    </>
  )
}
