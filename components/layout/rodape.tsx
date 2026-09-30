import { cn } from "@/lib/utils"

/** Rodapé com os créditos do sistema — no fim de toda página logada (LayoutWrapper) e no login. */
export function Rodape({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border pt-4 text-center text-xs text-muted-foreground", className)}>
      Escale · Criado e desenvolvido por <span className="font-medium text-foreground/80">Alan Vessani</span>
    </footer>
  )
}
