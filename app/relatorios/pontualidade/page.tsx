import Link from "next/link"
import { AlarmClock, CircleCheck, Clock, FileQuestion } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela, SecaoRelatorio } from "@/components/relatorio/pagina-relatorio"
import { buscarViagensPontualidade } from "@/lib/queries/relatorios/operacao"
import { PERIODO_PADRAO } from "@/lib/relatorios/catalogo"
import { periodoOuPadrao } from "@/lib/relatorios/periodo"
import { formatarDiaCurto, formatarDuracao, formatarHorarioRelativo, formatarPercentual } from "@/lib/relatorios/formato"
import { SEM_MOTIVO, TOLERANCIA_SAIDA_MINUTOS, analisarPontualidade, type GrupoPontualidade } from "@/lib/services/relatorios/operacao"
import { formatarHoraLocal } from "@/lib/utils/date-format"
import { formatarNomeProprio } from "@/lib/utils/texto"
import { cn } from "@/lib/utils"

type SearchParamsInput = { de?: string; ate?: string }

function TabelaGrupo({
  titulo,
  grupos,
  formatarNome,
}: {
  titulo: string
  grupos: GrupoPontualidade[]
  formatarNome?: (nome: string) => string
}) {
  return (
    <MolduraTabela>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{titulo}</TableHead>
            <TableHead className="text-right">Saídas</TableHead>
            <TableHead className="text-right">Atrasadas</TableHead>
            <TableHead className="text-right">No horário</TableHead>
            <TableHead className="text-right">Atraso médio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((grupo) => (
            <TableRow key={grupo.nome}>
              <TableCell className="font-medium">{formatarNome ? formatarNome(grupo.nome) : grupo.nome}</TableCell>
              <TableCell className="text-right tabular-nums">{grupo.saidas}</TableCell>
              <TableCell className={cn("text-right tabular-nums", grupo.atrasadas > 0 && "font-semibold text-destructive")}>
                {grupo.atrasadas}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatarPercentual(grupo.percentualNoHorario)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {grupo.atrasadas > 0 ? formatarDuracao(grupo.atrasoMedioMinutos) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </MolduraTabela>
  )
}

export default async function PontualidadePage({ searchParams }: { searchParams?: Promise<SearchParamsInput> }) {
  const parametros = (await searchParams) ?? {}
  const { filialId } = await requireSessaoPaginaComFilial()
  const periodo = periodoOuPadrao(parametros.de, parametros.ate, PERIODO_PADRAO.pontualidade)
  const resultado = analisarPontualidade(await buscarViagensPontualidade(filialId, periodo.de, periodo.ate))

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Pontualidade de saída">
        Horário real de saída (registrado no Dashboard) comparado com o início previsto da viagem. Até {TOLERANCIA_SAIDA_MINUTOS} min depois
        do previsto conta como no horário.
      </CabecalhoRelatorio>

      <FiltroRelatorio
        action="/relatorios/pontualidade"
        periodo={periodo}
        exportarTipo="pontualidade"
        exportarQuery={{ de: periodo.deTexto, ate: periodo.ateTexto }}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          rotulo="Saíram no horário"
          valor={resultado.saidasRegistradas ? formatarPercentual(resultado.percentualNoHorario) : "—"}
          icone={CircleCheck}
        />
        <StatCard
          rotulo="Saídas atrasadas"
          valor={`${resultado.atrasadas} de ${resultado.saidasRegistradas}`}
          icone={AlarmClock}
          classeValor={resultado.atrasadas > 0 ? "text-destructive" : undefined}
        />
        <StatCard
          rotulo="Atraso médio (das atrasadas)"
          valor={resultado.atrasadas ? formatarDuracao(resultado.atrasoMedioMinutos) : "—"}
          icone={Clock}
        />
        <StatCard
          rotulo="Iniciadas sem horário de saída"
          valor={resultado.semRegistro}
          icone={FileQuestion}
          classeValor={resultado.semRegistro > 0 ? "text-warning" : undefined}
        />
      </div>

      {resultado.saidasRegistradas === 0 ? (
        <EmptyState
          icone={Clock}
          titulo="Nenhuma saída registrada no período"
          descricao="O horário real de saída é registrado pelo Dashboard, na linha de cada viagem."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <SecaoRelatorio titulo="Por motivo do atraso">
              {resultado.porMotivo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atraso no período.</p>
              ) : (
                <MolduraTabela>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Atrasos</TableHead>
                        <TableHead className="text-right">Atraso médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.porMotivo.map((item) => (
                        <TableRow key={item.motivo}>
                          <TableCell className={cn("font-medium", item.motivo === SEM_MOTIVO && "text-muted-foreground italic")}>
                            {item.motivo}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatarDuracao(item.atrasoMedioMinutos)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </MolduraTabela>
              )}
            </SecaoRelatorio>

            <SecaoRelatorio titulo="Por cliente">
              <TabelaGrupo titulo="Cliente" grupos={resultado.porCliente} />
            </SecaoRelatorio>
          </div>

          <SecaoRelatorio titulo="Por motorista">
            <TabelaGrupo titulo="Motorista" grupos={resultado.porMotorista} formatarNome={formatarNomeProprio} />
          </SecaoRelatorio>

          {resultado.listaAtrasos.length > 0 && (
            <SecaoRelatorio titulo="Saídas atrasadas">
              <MolduraTabela>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead>Nº Viagem</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Previsto</TableHead>
                      <TableHead>Saiu</TableHead>
                      <TableHead>Atraso</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Clientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.listaAtrasos.map((atraso) => (
                      <TableRow key={atraso.id}>
                        <TableCell className="tabular-nums">{formatarDiaCurto(atraso.previsto)}</TableCell>
                        <TableCell className="font-mono">
                          <Link href={`/viagens/editar/${atraso.id}`} className="underline-offset-4 hover:underline">
                            {atraso.numViagem}
                          </Link>
                        </TableCell>
                        <TableCell>{formatarNomeProprio(atraso.motorista)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatarHoraLocal(atraso.previsto)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(atraso.real, atraso.previsto)}</TableCell>
                        <TableCell className="tabular-nums font-medium text-destructive">
                          +{formatarDuracao(atraso.atrasoMinutos)}
                        </TableCell>
                        <TableCell className={cn(atraso.motivo === SEM_MOTIVO && "text-muted-foreground italic")}>
                          {atraso.motivo}
                        </TableCell>
                        <TableCell className="max-w-56 truncate" title={atraso.clientes.join(", ")}>
                          {atraso.clientes.join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </MolduraTabela>
            </SecaoRelatorio>
          )}
        </>
      )}
    </div>
  )
}
