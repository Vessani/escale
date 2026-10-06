import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela } from "@/components/relatorio/pagina-relatorio"
import { buscarIntegracoesParaRelatorio } from "@/lib/queries/relatorios/operacao"
import { OPCOES_DIAS_INTEGRACAO, parseDiasIntegracao } from "@/lib/relatorios/catalogo"
import { formatarDiaCompleto } from "@/lib/relatorios/formato"
import { DIAS_INTEGRACAO_URGENTE, integracoesVencendo, textoVencimento, type SituacaoIntegracao } from "@/lib/services/relatorios/operacao"
import { formatarNomeProprio } from "@/lib/utils/texto"

type SearchParamsInput = { dias?: string }

const CLASSE_LINHA: Record<SituacaoIntegracao, string | undefined> = {
  VENCIDA: "bg-destructive/10 text-destructive hover:bg-destructive/15",
  URGENTE: "bg-warning/10 hover:bg-warning/15",
  VENCENDO: undefined,
}

const STATUS_TEXTO = { ATIVO: "Ativo", INATIVO: "Inativo", PENDENTE: "Pendente" } as const

export default async function IntegracoesPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const dias = parseDiasIntegracao(parametros.dias)
  const integracoes = integracoesVencendo(await buscarIntegracoesParaRelatorio(filialId, dias), new Date(), dias)
  const vencidas = integracoes.filter((integracao) => integracao.situacao === "VENCIDA").length

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Integrações vencendo">
        Integrações com clientes já vencidas ou que vencem nos próximos {dias} dias — pra renovar antes de o motorista ficar bloqueado pro
        cliente. Em vermelho as vencidas; em amarelo as que vencem em até {DIAS_INTEGRACAO_URGENTE} dias.
      </CabecalhoRelatorio>

      <FiltroRelatorio action="/relatorios/integracoes" exportarTipo="integracoes" exportarQuery={{ dias }}>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Vencendo em até
          <select
            name="dias"
            defaultValue={dias}
            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {OPCOES_DIAS_INTEGRACAO.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao} dias
              </option>
            ))}
          </select>
        </label>
      </FiltroRelatorio>

      {integracoes.length > 0 && (
        <p className="text-sm">
          <strong className={vencidas > 0 ? "text-destructive" : undefined}>{vencidas}</strong> vencida(s) ·{" "}
          <strong>{integracoes.length - vencidas}</strong> vencendo
        </p>
      )}

      {integracoes.length === 0 ? (
        <EmptyState
          icone={ShieldCheck}
          titulo="Tudo em dia"
          descricao={`Nenhuma integração vencida ou vencendo nos próximos ${dias} dias.`}
        />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integracoes.map((integracao) => (
                <TableRow
                  key={`${integracao.motoristaId}-${integracao.cliente}-${integracao.dataValidade.toISOString()}`}
                  className={CLASSE_LINHA[integracao.situacao]}
                >
                  <TableCell className="font-medium">
                    <Link href={`/motorista/editar/${integracao.motoristaId}`} className="underline-offset-4 hover:underline">
                      {formatarNomeProprio(integracao.motorista)}
                    </Link>
                  </TableCell>
                  <TableCell>{integracao.cliente}</TableCell>
                  <TableCell className="tabular-nums">{formatarDiaCompleto(integracao.dataValidade)}</TableCell>
                  <TableCell className="font-medium">{textoVencimento(integracao.diasParaVencer)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{STATUS_TEXTO[integracao.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MolduraTabela>
      )}
    </div>
  )
}
