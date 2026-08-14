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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Filiais</h1>
        <p className="text-slate-500 mt-1">Cada filial opera isolada — motoristas, viagens e frotas não são compartilhados entre elas.</p>
      </div>

      <CriarFilialForm />

      {filiais.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-12 text-slate-500">
            <Building2 className="w-8 h-8 text-slate-300" />
            <p>Nenhuma filial cadastrada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">Nome</TableHead>
                <TableHead className="font-semibold text-slate-700">Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filiais.map((filial) => (
                <TableRow key={filial.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{filial.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatarDataHoraPtBr(filial.criadoEm)}</Badge>
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
