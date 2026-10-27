"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import { Ban, Send } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cancelarEstouro, cancelarMeuEstouro, reenviarLinkEstouro, reenviarMeuLinkEstouro } from "@/lib/actions/estouro-jornada"
import { chamarAcao } from "@/lib/chamar-acao"
import type { LinkGerado } from "@/lib/services/estouro-jornada.service"
import { PainelEnvioWhatsApp } from "@/components/estouro/painel-envio-whatsapp"

/**
 * Ações de um pedido ainda sem resposta: mandar um link novo ou cancelar.
 * `doMotorista`: usada na área do motorista (actions que só mexem nos pedidos dele).
 */
export function AcoesEstouro({ id, motorista, doMotorista = false }: { id: number; motorista: string; doMotorista?: boolean }) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [link, setLink] = useState<LinkGerado | null>(null)
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false)

  const reenviar = () => {
    setErro(null)
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => (doMotorista ? reenviarMeuLinkEstouro(id) : reenviarLinkEstouro(id)))
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      setLink(resposta.link)
      router.refresh()
    })
  }

  const cancelar = () => {
    setErro(null)
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => (doMotorista ? cancelarMeuEstouro(id) : cancelarEstouro(id)))
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      setConfirmarCancelamento(false)
      router.refresh()
    })
  }

  return (
    <>
      <AcoesLinha>
        <BotaoIcone rotulo="Gerar novo link e reenviar" icone={Send} onClick={reenviar} disabled={pendente} />
        <BotaoIcone
          rotulo="Cancelar pedido"
          icone={Ban}
          perigo
          onClick={() => {
            setErro(null)
            setConfirmarCancelamento(true)
          }}
        />
      </AcoesLinha>
      {erro && !confirmarCancelamento && (
        <Alert variant="error" className="mt-2 text-left">
          {erro}
        </Alert>
      )}

      <Dialog.Root open={link !== null} onOpenChange={(aberto) => !aberto && setLink(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-6 shadow-xl text-left">
            <Dialog.Title className="text-lg font-semibold text-foreground">Novo link para {motorista}</Dialog.Title>
            <Dialog.Description className="mt-1 mb-4 text-sm text-foreground/80">
              O link anterior parou de funcionar. Envie este no grupo da filial.
            </Dialog.Description>
            {link && <PainelEnvioWhatsApp link={link} />}
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Fechar
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmarCancelamento}
        onOpenChange={setConfirmarCancelamento}
        title="Cancelar pedido de estouro"
        description={`O link enviado no grupo para ${motorista} deixa de funcionar. Dá pra pedir de novo depois.`}
        confirmLabel="Cancelar pedido"
        confirmingLabel="Cancelando..."
        cancelLabel="Voltar"
        confirming={pendente}
        erro={confirmarCancelamento ? erro : null}
        onConfirm={cancelar}
      />
    </>
  )
}
