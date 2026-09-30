import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2 } from "lucide-react"
import { buscarFiliais } from "@/lib/queries/filiais"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import CriarFilialForm from "./criar-filial-form"

export default async function FiliaisPage() {
  const filiais = await buscarFiliais()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Filiais</h1>
        <p className="text-muted-foreground mt-1" title="Motoristas, viagens e frotas não são compartilhados entre filiais.">Cada filial opera isolada, sem dados compartilhados.</p>
      </div>

      <CriarFilialForm />

      {filiais.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
            <Building2 className="w-8 h-8 text-muted-foreground/50" />
            <p>Nenhuma filial cadastrada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Nome</TableHead>
                <TableHead className="font-semibold text-foreground/80">Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filiais.map((filial) => (
                <TableRow key={filial.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{filial.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="tabular-nums">{formatarDataHoraPtBr(filial.criadoEm)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
