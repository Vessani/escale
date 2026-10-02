import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { requireSessaoPaginaMotorista } from "@/lib/auth-guard"
import { RelatorioViagemConteudo } from "@/components/viagem/relatorio-viagem-conteudo"
import { buscarMinhaViagem } from "@/lib/services/minhas-viagens.service"
import { carregarRelatorioViagem } from "@/lib/relatorios/relatorio-viagem"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { BotaoImprimir } from "./botao-imprimir"

export const metadata = { title: "Relatório da viagem" }

/**
 * Motorista: o relatório da viagem dele (principal ou acompanhante), pra
 * imprimir ou salvar em PDF pelo navegador. Mesmo conteúdo do escalador.
 */
export default async function MeuRelatorioViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { filialId, motoristaId } = await requireSessaoPaginaMotorista()
  const id = Number((await params).id)
  // Só a viagem dele: a mesma checagem da tela da viagem (não revela se outra existe).
  const minha = Number.isInteger(id) && id > 0 ? await buscarMinhaViagem(filialId, motoristaId, id) : null
  const r = minha ? await carregarRelatorioViagem(filialId, id) : null

  const voltar = (
    <Link href={minha ? `${AREA_MOTORISTA}/${id}` : AREA_MOTORISTA} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground print:hidden">
      <ArrowLeft className="size-4" aria-hidden /> {minha ? "Voltar para a viagem" : "Minhas viagens"}
    </Link>
  )
  if (!r) {
    return (
      <>
        {voltar}
        <Alert variant="warning">Essa viagem não está com você.</Alert>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 print:hidden">
        {voltar}
        <BotaoImprimir />
      </div>
      <RelatorioViagemConteudo r={r} />
    </>
  )
}
