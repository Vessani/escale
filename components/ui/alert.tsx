import * as React from "react"
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

export type AlertVariant = "warning" | "success" | "error" | "info"

const ALERT_ICONS: Record<AlertVariant, typeof AlertTriangle> = {
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const ALERT_COLOR_CLASSES: Record<AlertVariant, string> = {
  warning: "text-warning",
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
}

const ALERT_CONTAINER_CLASSES: Record<AlertVariant, string> = {
  warning: "border-warning/30 bg-warning/10",
  success: "border-success/30 bg-success/10",
  error: "border-destructive/30 bg-destructive/10",
  info: "border-info/30 bg-info/10",
}

type AlertProps = React.ComponentProps<"div"> & {
  variant?: AlertVariant
  /** Versão compacta sem borda/fundo, pra usar dentro de células de tabela/linhas — em vez do bloco cheio. */
  inline?: boolean
}

/** Mensagem inline de aviso/sucesso/erro/info — substitui os blocos de "aviso" que eram copiados à mão em cada tela. */
function Alert({ className, variant = "info", inline = false, children, ...props }: AlertProps) {
  const Icon = ALERT_ICONS[variant]

  return (
    <div
      data-slot="alert"
      role="status"
      className={cn(
        "flex items-start gap-1.5 text-xs",
        ALERT_COLOR_CLASSES[variant],
        !inline && ["rounded-none border px-3 py-2", ALERT_CONTAINER_CLASSES[variant]],
        className
      )}
      {...props}
    >
      <Icon className={cn("shrink-0", inline ? "size-3" : "mt-0.5 size-3.5")} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export { Alert }
