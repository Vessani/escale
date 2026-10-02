import { Truck } from "lucide-react"

/** Marca do sistema: quadrado com o caminhão + nome. `compacto` mostra só o quadrado (sidebar colapsada). A cor do nome vem do contêiner. */
export function LogoEscalador({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="size-8 shrink-0 rounded-lg bg-destaque text-destaque-foreground grid place-items-center">
        <Truck aria-hidden="true" className="size-4" />
      </span>
      {compacto ? <span className="sr-only">Escalador</span> : <span className="font-semibold tracking-tight text-lg">Escalador</span>}
    </span>
  )
}
