import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buscarHistoricoDoDia } from "@/lib/queries/auditoria"
import { inicioDoDia, fimDoDia, parseDataLocal, formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { serializeData } from "@/lib/serialization"
import { diffAuditoria, formatarCampoAlterado } from "@/lib/utils/diff-auditoria"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Filter } from "lucide-react"
import Link from "next/link"
import type { AcaoAuditoria } from "@prisma/client"

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

type SearchParamsInput = {
  de?: string
  ate?: string
}

/** YYYY-MM-DD local (sem componente de hora) — mesmo formato de <input type="date">. */
function dataLocalParaInput(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

/** Padrão = ontem, não hoje — o pedido era especificamente "consultar um dia passado", e um instalação nova não teria nada em "hoje" ainda. */
function ontemParaInput() {
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  return dataLocalParaInput(ontem)
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsInput>
}) {
  const parametros = (await searchParams) ?? {}
  const padrao = ontemParaInput()
  const deTexto = parametros.de ?? padrao
  const ateTexto = parametros.ate ?? padrao
  const de = inicioDoDia(parseDataLocal(deTexto))
  const ate = fimDoDia(parseDataLocal(ateTexto))

  const session = await getServerSession(authOptions)
  const filialId = session!.user.filialId!

  const registros = serializeData(await buscarHistoricoDoDia(filialId, de, ate))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Histórico</h1>
        <p className="text-slate-500 mt-1">
          Tudo que mudou (viagens, motoristas, frotas, clientes, quadro de recados...) num período — quem mudou e o quê.
        </p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">De</label>
              <Input type="date" name="de" defaultValue={deTexto} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Até</label>
              <Input type="date" name="ate" defaultValue={ateTexto} className="w-40" />
            </div>
            <Button type="submit" variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar período
            </Button>
            <Link href="/historico">
              <Button type="button" variant="ghost">
                Ontem
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg">
            {registros.length} mudança{registros.length === 1 ? "" : "s"} no período
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {registros.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma mudança registrada nesse período.</p>
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
                      <span className="text-slate-500">{formatarDataHoraPtBr(registro.criadoEm)}</span>
                      <Badge variant="outline" className={CLASSE_BADGE_ACAO[registro.acao]}>
                        {LABEL_ACAO[registro.acao]}
                      </Badge>
                      <span className="font-medium text-slate-900">{registro.entidade}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-700">{registro.usuarioNome ?? "Sistema"}</span>
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
    </div>
  )
}
