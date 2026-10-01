import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export default function NaoEncontrado() {
  return (
    <EmptyState
      icone={SearchX}
      titulo="Página não encontrada"
      descricao="O endereço pode estar errado, ou o registro foi excluído."
      acao={
        <Button asChild variant="outline">
          <Link href="/">Ir pro Dashboard</Link>
        </Button>
      }
    />
  )
}
