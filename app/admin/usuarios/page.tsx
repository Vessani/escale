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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Usuários</h1>
        <p className="text-muted-foreground mt-1" title="Cada usuário pertence a uma filial (exceto Superadmin) e só vê os dados dela.">Cada usuário só vê os dados da própria filial.</p>
      </div>

      <CriarUsuarioForm filiais={filiais} />

      {usuarios.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
            <UserCog className="w-8 h-8 text-muted-foreground/50" />
            <p>Nenhum usuário cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Nome</TableHead>
                <TableHead className="font-semibold text-foreground/80">E-mail</TableHead>
                <TableHead className="font-semibold text-foreground/80">Papel</TableHead>
                <TableHead className="font-semibold text-foreground/80">Filial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id} className="hover:bg-muted/50">
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
