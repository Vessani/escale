import Link from "next/link"
import { TriangleAlert } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela, textoFrota } from "@/components/relatorio/pagina-relatorio"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { buscarViagensComAviso } from "@/lib/queries/relatorios/operacao"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCurto } from "@/lib/relatorios/formato"
import { listarAvisos } from "@/lib/services/relatorios/operacao"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"

type SearchParamsInput = { de?: string; ate?: string }

export default async function ViagensComAvisoPage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.avisos)
  const viagens = await buscarViagensComAviso(filialId, periodo.de, periodo.ate)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Viagens com aviso">
        Viagens (não canceladas) que foram com algum aviso do sistema — descanso, frota indisponível, frota de outro produto
        ou que não consta no relatório de jornada — e quem fez a última alteração nelas. Passe o mouse no aviso pra ver o
        detalhe.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/avisos"
        periodo={periodo}
        exportarTipo="avisos"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      {viagens.length === 0 ? (
        <EmptyState icone={TriangleAlert} titulo="Nenhuma viagem com aviso" descricao="Nenhuma viagem do período tem aviso gravado." />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead>Avisos</TableHead>
                <TableHead>Última alteração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viagens.map((viagem) => (
                <TableRow key={viagem.id}>
                  <TableCell className="tabular-nums">{formatarDiaCurto(viagem.inicioPrevisto)}</TableCell>
                  <TableCell className="font-mono">
                    <Link href={`/viagens/editar/${viagem.id}`} className="underline-offset-4 hover:underline">{viagem.numViagem}</Link>
                  </TableCell>
                  <TableCell>
                    <Badge dot variant="outline" className={classeBadgeStatusViagem(viagem.status)}>{formatarStatusViagem(viagem.status)}</Badge>
                  </TableCell>
                  <TableCell>{viagem.motorista ? formatarNomeProprio(viagem.motorista.nome) : "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{textoFrota(viagem.cavalo, viagem.carreta)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {listarAvisos(viagem).map((aviso) => (
                        <Alert key={aviso.rotulo} variant="warning" inline title={aviso.detalhe}>{aviso.rotulo}</Alert>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {viagem.alteradoPor ?? "—"}
                    {viagem.alteradoEm && <div className="text-xs text-muted-foreground">{formatarDataHoraPtBr(viagem.alteradoEm)}</div>}
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
