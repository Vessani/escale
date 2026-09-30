import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2 } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
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
        <EmptyState icone={Building2} titulo="Nenhuma filial" descricao="Cadastre a primeira filial no formulário acima." />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filiais.map((filial) => (
                <TableRow key={filial.id}>
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
