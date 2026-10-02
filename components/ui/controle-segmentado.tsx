"use client"

import { cn } from "@/lib/utils"

/**
 * Escolha entre poucas opções lado a lado (Pedágio/Pernoite, Manômetro/
 * Balança, Escalador/Motorista). `largo`: ocupa a linha toda, opções do
 * mesmo tamanho (celular).
 */
export function ControleSegmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
  largo = false,
  className,
}: {
  opcoes: ReadonlyArray<{ valor: T; rotulo: string }>
  valor: T | null
  onChange: (valor: T) => void
  /** Nome do grupo pra leitor de tela. */
  rotulo: string
  largo?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={rotulo} className={cn("inline-flex rounded-lg border bg-muted/40 p-1", largo && "w-full", className)}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={valor === opcao.valor}
          onClick={() => onChange(opcao.valor)}
          className={cn(
            "rounded-md text-sm transition-colors",
            largo ? "flex-1 px-3 py-2" : "px-4 py-1.5",
            valor === opcao.valor
              ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}
