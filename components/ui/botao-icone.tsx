import * as React from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BotaoIconeProps = {
  /** Texto da ação — vira o tooltip (title) e o nome acessível (aria-label), já que o botão não tem texto visível. */
  rotulo: string
  icone: LucideIcon
  /** Ação destrutiva (excluir): ícone em vermelho. */
  perigo?: boolean
  className?: string
} & (
  | { href: string; onClick?: never; disabled?: never; prefetch?: boolean }
  | { href?: never; onClick: () => void; disabled?: boolean; prefetch?: never }
)

/**
 * Botão só com ícone pras ações de linha de tabela (baixar, editar,
 * excluir): todos do mesmo tamanho, lado a lado, sem quebrar linha — no
 * lugar de botões com texto de larguras diferentes. Com `href` vira um link
 * de verdade (e não um <button> dentro de <a>, que é HTML inválido).
 */
export function BotaoIcone({ rotulo, icone: Icone, perigo = false, className, ...acao }: BotaoIconeProps) {
  const classes = cn(
    "text-muted-foreground",
    perigo ? "hover:bg-destructive/10 hover:text-destructive" : "hover:text-foreground",
    className,
  )

  if (acao.href !== undefined) {
    return (
      <Button asChild variant="ghost" size="icon-sm" className={classes}>
        <Link href={acao.href} prefetch={acao.prefetch} title={rotulo} aria-label={rotulo}>
          <Icone aria-hidden />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={classes}
      title={rotulo}
      aria-label={rotulo}
      onClick={acao.onClick}
      disabled={acao.disabled}
    >
      <Icone aria-hidden />
    </Button>
  )
}

/** Agrupa os botões de ação de uma linha: sempre numa linha só, alinhados à direita. */
export function AcoesLinha({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-nowrap items-center justify-end gap-0.5", className)}>{children}</div>
}
