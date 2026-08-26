import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { diffAuditoria, formatarCampoAlterado } from "@/lib/utils/diff-auditoria"
import type { RegistroAuditoria, AcaoAuditoria } from "@prisma/client"
import type { SerializedData } from "@/lib/serialization"

const LABEL_ACAO: Record<AcaoAuditoria, string> = {
  CRIACAO: "Criação",
  ATUALIZACAO: "Atualização",
  EXCLUSAO: "Exclusão",
}

const CLASSE_BADGE_ACAO: Record<AcaoAuditoria, string> = {
  CRIACAO: "border-success/30 bg-success/10 text-success hover:bg-success/10",
  ATUALIZACAO: "border-info/30 bg-info/10 text-info hover:bg-info/10",
  EXCLUSAO: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10",
}

type Registro = SerializedData<RegistroAuditoria>

/** Painel só-leitura com o histórico de mudanças de um registro — reusado em Viagem/Motorista/Frota/Cliente. */
export function HistoricoCard({ registros, titulo = "Histórico" }: { registros: Registro[]; titulo?: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="text-lg">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {registros.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma mudança registrada ainda.</p>
        ) : (
          <ul className="space-y-4">
            {registros.map((registro) => {
              const alteracoes = diffAuditoria(
                registro.antes as Record<string, unknown> | null,
                registro.depois as Record<string, unknown> | null,
              )

              return (
                <li key={registro.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className={CLASSE_BADGE_ACAO[registro.acao]}>
                      {LABEL_ACAO[registro.acao]}
                    </Badge>
                    <span className="text-slate-500">{formatarDataHoraPtBr(registro.criadoEm)}</span>
                    <span className="text-slate-500">·</span>
                    <span className="font-medium text-slate-700">{registro.usuarioNome ?? "Sistema"}</span>
                  </div>
                  {alteracoes.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {alteracoes.map((alteracao) => (
                        <li key={alteracao.campo}>{formatarCampoAlterado(alteracao)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
