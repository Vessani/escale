import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCog } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
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
        <EmptyState icone={UserCog} titulo="Nenhum usuário" descricao="Cadastre o primeiro usuário no formulário acima." />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Filial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
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
