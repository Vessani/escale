import { FileCheck2, Pencil } from "lucide-react"
import { requireSessaoPaginaComFilial } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CabecalhoRelatorio, FiltroRelatorio, MolduraTabela, textoFrota } from "@/components/relatorio/pagina-relatorio"
import { classeBadgeStatusViagem } from "@/app/viagens/badge-styles"
import { buscarViagensNaoConstam } from "@/lib/queries/relatorios/operacao"
import { formatarDiaCurto, formatarHorarioRelativo } from "@/lib/relatorios/formato"
import { formatarStatusViagem } from "@/lib/services/viagem-status.service"
import { formatarNomeProprio } from "@/lib/utils/texto"

export default async function NaoConstaPage() {
  const { filialId } = await requireSessaoPaginaComFilial()
  const viagens = await buscarViagensNaoConstam(filialId)

  return (
    <div className="space-y-6">
      <CabecalhoRelatorio titulo="Não consta no relatório">
        Viagens em dias que o relatório de jornada já cobre, mas sem o motorista trabalhando em nenhum deles — provavelmente
        não aconteceram ou foram com outro motorista. Elas já não contam pro descanso; cancele ou corrija cada uma pra sair
        daqui.
      </CabecalhoRelatorio>

      <FiltroRelatorio action="/relatorios/nao-consta" exportarTipo="nao-consta" exportarQuery={{}} />

      {viagens.length === 0 ? (
        <EmptyState icone={FileCheck2} titulo="Nada pendente" descricao="Todas as viagens batem com o relatório de jornada." />
      ) : (
        <MolduraTabela>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Nº Viagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim previsto</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viagens.map((viagem) => (
                <TableRow key={viagem.id}>
                  <TableCell className="tabular-nums">{formatarDiaCurto(viagem.inicioPrevisto)}</TableCell>
                  <TableCell className="font-mono">{viagem.numViagem}</TableCell>
                  <TableCell>
                    <Badge dot variant="outline" className={classeBadgeStatusViagem(viagem.status)}>{formatarStatusViagem(viagem.status)}</Badge>
                  </TableCell>
                  <TableCell>{viagem.motorista ? formatarNomeProprio(viagem.motorista.nome) : "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(viagem.inicioPrevisto, viagem.inicioPrevisto)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatarHorarioRelativo(viagem.fimPrevisto, viagem.inicioPrevisto)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{textoFrota(viagem.cavalo, viagem.carreta)}</TableCell>
                  <TableCell>
                    <AcoesLinha>
                      <BotaoIcone rotulo="Editar viagem" icone={Pencil} href={`/viagens/editar/${viagem.id}`} />
                    </AcoesLinha>
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
