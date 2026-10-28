"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import { Ban, Send } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { chamarAcao } from "@/lib/chamar-acao"
import type { LinkGerado } from "@/lib/services/link-aprovacao"
import type { RespostaAcao } from "@/lib/types/types"
import { PainelEnvioWhatsApp } from "@/components/aprovacao/painel-envio-whatsapp"
import { useSomenteLeitura } from "@/components/layout/somente-leitura"

type RespostaLink = { sucesso: true; link: LinkGerado } | { sucesso: false; erro: string }

type Props = {
  motorista: string
  /** "estouro", "Uber" — entra no título do aviso de cancelar. */
  tipoPedido: string
  reenviarLink: () => Promise<RespostaLink>
  cancelarPedido: () => Promise<RespostaAcao>
}

/**
 * Ações de um pedido por link ainda sem resposta (estouro, Uber): mandar um
 * link novo ou cancelar. Cada tipo de pedido passa as actions dele (ver
 * AcoesEstouro, AcoesUber).
 */
export function AcoesPedidoLink(props: Props) {
  // Torre só acompanha: quem reenvia o link ou cancela é a filial.
  const somenteLeitura = useSomenteLeitura()
  return somenteLeitura ? null : <AcoesEditaveis {...props} />
}

function AcoesEditaveis({ motorista, tipoPedido, reenviarLink, cancelarPedido }: Props) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [link, setLink] = useState<LinkGerado | null>(null)
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false)

  const reenviar = () => {
    setErro(null)
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(reenviarLink)
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
      const resposta = await chamarAcao(cancelarPedido)
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
        title={`Cancelar pedido de ${tipoPedido}`}
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
