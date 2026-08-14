import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building, PlusCircle } from "lucide-react"
import { buscarClientes } from "@/lib/queries/clientes"
import ExcluirClienteButton from "./excluir-cliente-button"

export default async function ClientesPage() {
  const [clientes, session] = await Promise.all([buscarClientes(), getServerSession(authOptions)])
  const podeGerenciar = session?.user?.role === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Clientes</h1>
          <p className="text-slate-500 mt-1">
            Nomes usados nas entregas da viagem e nas integrações do motorista. Marcar &quot;Exige integração&quot; passa a cobrar integração ativa em qualquer viagem pra esse cliente.
          </p>
        </div>
        {podeGerenciar && (
          <Link href="/clientes/novo">
            <Button>
              <PlusCircle className="w-5 h-5 mr-2" />
              Novo Cliente
            </Button>
          </Link>
        )}
      </div>

      {clientes.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-12 text-slate-500">
            <Building className="w-8 h-8 text-slate-300" />
            <p>Nenhum cliente cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">Nome</TableHead>
                <TableHead className="font-semibold text-slate-700">Exige integração</TableHead>
                {podeGerenciar && <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>
                    {cliente.exigeIntegracao ? (
                      <Badge variant="warning">Sim</Badge>
                    ) : (
                      <Badge variant="outline">Não</Badge>
                    )}
                  </TableCell>
                  {podeGerenciar && (
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/clientes/editar/${cliente.id}`}>
                          <Button variant="outline" size="sm">Editar</Button>
                        </Link>
                        <ExcluirClienteButton clienteId={cliente.id} nome={cliente.nome} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
