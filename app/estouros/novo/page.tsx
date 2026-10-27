import Link from "next/link"
import type { Metadata } from "next"
import { ArrowLeft, Hourglass } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { PAPEIS_ESCALADOR } from "@/lib/papeis"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buscarOpcoesSolicitacao } from "@/lib/services/estouro-jornada.service"
import { FormEstouro } from "@/components/estouro/form-estouro"

export const metadata: Metadata = { title: "Pedir estouro de jornada" }

export default async function NovoEstouroPage() {
  const { filialId } = await requireSessaoPaginaComFilial(PAPEIS_ESCALADOR)
  const { motoristas, viagens } = await buscarOpcoesSolicitacao(filialId)

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-3">
        <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Link href="/estouros" aria-label="Voltar para a lista">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pedir estouro de jornada</h1>
          <p className="text-muted-foreground mt-1">Registra o pedido e gera o link de aprovação para o grupo da filial.</p>
        </div>
      </div>
      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hourglass className="size-5" aria-hidden /> Pedido de estouro
          </CardTitle>
          <CardDescription>O link vai pro grupo de WhatsApp da filial e o gestor aprova ou recusa por ele.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FormEstouro modo="escalador" motoristas={motoristas} viagens={viagens} voltarHref="/estouros" />
        </CardContent>
      </Card>
    </div>
  )
}
