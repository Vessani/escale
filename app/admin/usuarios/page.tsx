import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCog } from "lucide-react"
import { buscarUsuarios } from "@/lib/queries/usuarios"
import { buscarFiliais } from "@/lib/queries/filiais"
import CriarUsuarioForm from "./criar-usuario-form"

export default async function UsuariosPage() {
  const [usuarios, filiais] = await Promise.all([buscarUsuarios(), buscarFiliais()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Usuários</h1>
        <p className="text-slate-500 mt-1">Cada usuário pertence a uma filial (exceto Superadmin) e só vê os dados dela.</p>
      </div>

      <CriarUsuarioForm filiais={filiais} />

      {usuarios.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-12 text-slate-500">
            <UserCog className="w-8 h-8 text-slate-300" />
            <p>Nenhum usuário cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">Nome</TableHead>
                <TableHead className="font-semibold text-slate-700">E-mail</TableHead>
                <TableHead className="font-semibold text-slate-700">Papel</TableHead>
                <TableHead className="font-semibold text-slate-700">Filial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{usuario.nome ?? "-"}</TableCell>
                  <TableCell>{usuario.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{usuario.role}</Badge>
                  </TableCell>
                  <TableCell>{usuario.filial?.nome ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
