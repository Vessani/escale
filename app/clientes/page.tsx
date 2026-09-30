import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building, PlusCircle } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { buscarClientes } from "@/lib/queries/clientes"
import ExcluirClienteButton from "./excluir-cliente-button"

export default async function ClientesPage() {
  const [clientes, session] = await Promise.all([buscarClientes(), getServerSession(authOptions)])
  const podeGerenciar = session?.user?.role === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
          <p
            className="text-muted-foreground mt-1"
            title="Nomes usados nas entregas da viagem e nas integrações do motorista. Marcar &quot;Exige integração&quot; passa a cobrar integração ativa em qualquer viagem pra esse cliente."
          >
            Clientes das entregas e exigência de integração.
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
        <EmptyState
          icone={Building}
          titulo="Nenhum cliente"
          descricao="Nenhum cliente cadastrado ainda."
          acao={
            podeGerenciar && (
              <Link href="/clientes/novo">
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Novo cliente
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>SAP Code</TableHead>
                <TableHead>Exige integração</TableHead>
                {podeGerenciar && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell className="font-mono tabular-nums text-foreground/80">{cliente.numeroSap}</TableCell>
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
