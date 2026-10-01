import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type CartaoRelatorio = {
  href: string
  titulo: string
  descricao: string
  icone: LucideIcon
  /** Número de pendências; acima de zero aparece em destaque. */
  contagem?: number
  /** Texto curto ao lado do número (ex: "nos últimos 30 dias"). */
  contagemTexto?: string
}

/** Grade de atalhos pros relatórios — o cartão inteiro é o link. */
export function GradeRelatorios({ titulo, cartoes }: { titulo: string; cartoes: CartaoRelatorio[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cartoes.map(({ href, titulo: tituloCartao, descricao, icone: Icone, contagem, contagemTexto }) => (
          <Link
            key={href}
            href={href}
            className="group flex gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <Icone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{tituloCartao}</p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">{descricao}</p>
              {contagem !== undefined && (
                <p className="text-sm">
                  <span
                    className={cn(
                      "inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                      contagem > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {contagem}
                  </span>{" "}
                  <span className="text-muted-foreground">{contagemTexto}</span>
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
