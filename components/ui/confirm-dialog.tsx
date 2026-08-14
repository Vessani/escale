"use client"

import { Dialog } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirming?: boolean
  erro?: string | null
  onConfirm: () => void
}

/** Confirmação de ação destrutiva sobre o Dialog do Radix, no lugar de window.confirm/window.alert. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  confirming = false,
  erro,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(novoValor) => !confirming && onOpenChange(novoValor)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-slate-900">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-600">{description}</Dialog.Description>

          {erro ? (
            <Alert variant="error" className="mt-3">
              {erro}
            </Alert>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={confirming}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button type="button" variant="destructive" disabled={confirming} onClick={onConfirm}>
              {confirming ? "Excluindo..." : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
