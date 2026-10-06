import { requireSessaoPagina } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCog } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { buscarUsuarios } from "@/lib/queries/usuarios"
import { buscarFiliais } from "@/lib/queries/filiais"
import CriarUsuarioForm from "./criar-usuario-form"
import AlternarAtivoButton from "./alternar-ativo-button"
import { AcoesLinha } from "@/components/ui/botao-icone"

export default async function UsuariosPage() {
  const session = await requireSessaoPagina(["SUPERADMIN"])
  const [usuarios, filiais] = await Promise.all([buscarUsuarios(), buscarFiliais()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Usuários</h1>
        <p className="text-muted-foreground mt-1" title="Cada usuário pertence a uma filial (exceto Superadmin) e só vê os dados dela.">
          Cada usuário só vê os dados da própria filial.
        </p>
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
                <TableHead>Situação</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id} className={usuario.ativo ? undefined : "text-muted-foreground"}>
                  <TableCell className="font-medium">{usuario.nome ?? "-"}</TableCell>
                  <TableCell>{usuario.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{usuario.role}</Badge>
                  </TableCell>
                  <TableCell>{usuario.filial?.nome ?? "-"}</TableCell>
                  <TableCell>
                    {usuario.ativo ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Desativado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <AcoesLinha>
                      {usuario.id !== session.user.id && (
                        <AlternarAtivoButton
                          usuarioId={usuario.id}
                          nome={usuario.nome ?? usuario.email ?? "Este usuário"}
                          ativo={usuario.ativo}
                        />
                      )}
                    </AcoesLinha>
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
