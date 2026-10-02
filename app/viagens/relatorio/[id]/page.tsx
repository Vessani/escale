import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Download } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { RelatorioViagemConteudo } from "@/components/viagem/relatorio-viagem-conteudo"
import { carregarRelatorioViagem } from "@/lib/relatorios/relatorio-viagem"

export const metadata = { title: "Relatório da viagem" }

/** Escalador: relatório da viagem com "Baixar Excel". */
export default async function RelatorioViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { filialId } = await requireSessaoPaginaComFilial()
  const id = Number((await params).id)
  const r = Number.isInteger(id) && id > 0 ? await carregarRelatorioViagem(filialId, id) : null
  if (!r) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/viagens/editar/${r.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Voltar para a viagem
        </Link>
        <Button asChild>
          <a href={`/api/viagens/${r.id}/relatorio`}>
            <Download className="mr-1.5 size-4" aria-hidden /> Baixar Excel
          </a>
        </Button>
      </div>
      <RelatorioViagemConteudo r={r} />
    </div>
  )
}
