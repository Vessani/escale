import { Download } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NomeMotorista } from "@/components/motorista/icone-tipo-motorista"
import { STATUS_ALTERAVEIS_NO_DASHBOARD } from "@/lib/services/dashboard.service"
import { formatDateForDateInput, formatarDataHoraPtBr, formatarHoraLocal, inicioDoDia } from "@/lib/utils/date-format"
import { RotaDestinos } from "@/components/viagem/rota-destinos"
import AtualizarSaidaReal from "@/app/atualizar-saida-real"
import AtualizarStatusRapido from "@/app/viagens/atualizar-status-rapido"
import { formatarCodigoFrota } from "@/lib/services/frota-regras"
import { BotaoIcone } from "@/components/ui/botao-icone"
import type { ItemDashboard } from "@/lib/queries/dashboard"

/** Viagens em andamento do Dashboard: tabela (telas largas) e cartões (celular). */

function entregasDaViagem(item: ItemDashboard) {
  return item.viagem.entregas
}

/**
 * Início previsto compacto: só a hora quando a viagem é do dia mostrado
 * (o caso comum no painel), com a data na frente quando é de outro dia
 * (ex: "Retornando" que saiu ontem).
 */
function InicioPrevisto({ inicio, diaMostrado }: { inicio: string | Date; diaMostrado: string }) {
  const mesmoDia = formatDateForDateInput(inicioDoDia(new Date(inicio))) === diaMostrado
  const completo = formatarDataHoraPtBr(inicio)

  return (
    <span title={completo} className="font-mono tabular-nums text-foreground">
      {mesmoDia ? formatarHoraLocal(inicio) : completo.replace(/\/\d{4},/, "")}
    </span>
  )
}

/**
 * Motorista(s) só pra leitura — o Dashboard é painel de acompanhamento;
 * alocar e trocar motorista é na Gestão de Viagens.
 */
function MotoristaCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item

  return (
    <div className="space-y-0.5">
      {viagem.motorista ? (
        <NomeMotorista nome={viagem.motorista.nome} tipo={viagem.motorista.tipo} className="font-medium text-foreground" />
      ) : (
        <Badge variant="warning">Sem motorista</Badge>
      )}
      {viagem.motoristaAcompanhante && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <span aria-hidden>+</span>
          <span className="sr-only">Acompanhante:</span>
          <NomeMotorista nome={viagem.motoristaAcompanhante.nome} tipo={viagem.motoristaAcompanhante.tipo} />
        </p>
      )}
      {viagem.avisoInterjornada && (
        <Alert variant="warning" inline title={viagem.avisoInterjornada}>
          Interjornada
        </Alert>
      )}
      {viagem.problemaMecanico && (
        <Alert variant="error" inline title={viagem.problemaMecanico}>
          Problema mecânico
        </Alert>
      )}
    </div>
  )
}

function FrotaCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item
  return (
    <div className="space-y-0.5">
      <p className="font-mono font-medium tabular-nums text-foreground">{viagem.numViagem}</p>
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground" title="Cavalo / carreta">
        {formatarCodigoFrota(viagem.cavalo)} / {formatarCodigoFrota(viagem.carreta)}
      </p>
      {viagem.avisoFrotaIndisponivel && (
        <Alert variant="warning" inline title={viagem.avisoFrotaIndisponivel}>
          Indisponível
        </Alert>
      )}
      {viagem.avisoFrotaProdutoIncompativel && (
        <Alert variant="warning" inline title={viagem.avisoFrotaProdutoIncompativel}>
          Outro produto
        </Alert>
      )}
    </div>
  )
}

function SaidaCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item
  return (
    <AtualizarSaidaReal
      viagemId={viagem.id}
      inicioPrevisto={viagem.inicioPrevisto}
      horarioRealSaidaInicial={viagem.horarioRealSaida}
      motivoAtrasoInicial={viagem.motivoAtraso}
    />
  )
}

/** Viagem ativa que vem de um dia anterior: "desde 01/10" (saiu e não encerrou) ou "não saiu (01/10)". */
function PendenciaDeOutroDia({ pendencia }: { pendencia: ItemDashboard["pendencia"] }) {
  if (!pendencia) return null
  const dia = formatarDataHoraPtBr(pendencia.desde).slice(0, 5)
  if (pendencia.tipo === "NAO_SAIU") {
    return (
      <Alert variant="warning" inline title="Era pra ter saído num dia anterior e continua sem sair: inicie, posterge ou cancele.">
        Não saiu ({dia})
      </Alert>
    )
  }
  return pendencia.atrasada ? (
    <Alert variant="warning" inline title="Saiu num dia anterior, o fim previsto já passou e a viagem não foi encerrada.">
      Desde {dia}
    </Alert>
  ) : (
    <p className="text-[11px] text-muted-foreground" title="Saiu num dia anterior e ainda está em andamento.">
      Desde {dia}
    </p>
  )
}

function StatusCelula({ item }: { item: ItemDashboard }) {
  const { viagem } = item
  return (
    <div className="space-y-1">
      <AtualizarStatusRapido
        // A chave muda com o status: quando o motorista inicia/encerra pelo
        // celular e o painel se atualiza sozinho, o seletor reflete na hora
        // (sem a chave ele guardava o status de quando a tela abriu).
        key={`${viagem.id}-${viagem.status}`}
        viagemId={viagem.id}
        statusAtual={viagem.status}
        inicioPrevisto={viagem.inicioPrevisto}
        fimPrevisto={viagem.fimPrevisto}
        opcoesPermitidas={STATUS_ALTERAVEIS_NO_DASHBOARD}
      />
      <PendenciaDeOutroDia pendencia={item.pendencia} />
    </div>
  )
}

/** Excel de uma viagem (ordem de viagem) — pra mandar pro motorista. */
function BaixarOrdemDeViagem({ viagemId }: { viagemId: number }) {
  // prefetch desligado: é um download de arquivo, não uma página.
  return <BotaoIcone href={`/api/viagens/${viagemId}/excel`} prefetch={false} rotulo="Baixar ordem de viagem (Excel)" icone={Download} />
}

/** Tabela para telas a partir de md; em telas menores vira lista de cards (ver ViagensEmAndamentoCards). */
export function ViagensEmAndamentoTabela({ itens, diaMostrado }: { itens: ItemDashboard[]; diaMostrado: string }) {
  // table-fixed + larguras por coluna: a tabela sempre cabe na largura da
  // tela (sem barra de rolagem lateral) — o que não cabe numa coluna é
  // truncado, com o texto completo no tooltip.
  return (
    <div className="hidden rounded-lg border bg-card shadow-sm overflow-hidden md:block">
      <Table className="table-fixed" containerClassName="max-h-[70vh] overflow-y-auto overflow-x-hidden">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[17%]" />
          <col />
          <col className="fora-do-modo-tv w-11" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow>
            <TableHead>Motorista(s)</TableHead>
            <TableHead>Viagem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Saída real</TableHead>
            <TableHead>Destinos</TableHead>
            <TableHead className="fora-do-modo-tv">
              <span className="sr-only">Ordem de viagem</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={item.viagem.id}>
              <TableCell className="overflow-hidden">
                <MotoristaCelula item={item} />
              </TableCell>
              <TableCell className="overflow-hidden">
                <FrotaCelula item={item} />
              </TableCell>
              <TableCell>
                <StatusCelula item={item} />
              </TableCell>
              <TableCell>
                <InicioPrevisto inicio={item.viagem.inicioPrevisto} diaMostrado={diaMostrado} />
              </TableCell>
              <TableCell className="overflow-hidden">
                <SaidaCelula item={item} />
              </TableCell>
              <TableCell className="overflow-hidden">
                <RotaDestinos entregas={entregasDaViagem(item)} />
              </TableCell>
              <TableCell className="fora-do-modo-tv px-1">
                <BaixarOrdemDeViagem viagemId={item.viagem.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Lista em cards para telas abaixo de md; substitui a tabela (ver ViagensEmAndamentoTabela). */
export function ViagensEmAndamentoCards({ itens }: { itens: ItemDashboard[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {itens.map((item) => (
        <div key={item.viagem.id} className="space-y-3 rounded-lg border bg-card shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Viagem <span className="font-mono tabular-nums">{item.viagem.numViagem}</span> ·{" "}
                <span className="font-mono tabular-nums">
                  {formatarCodigoFrota(item.viagem.cavalo)} / {formatarCodigoFrota(item.viagem.carreta)}
                </span>
              </p>
              {item.viagem.avisoFrotaIndisponivel && (
                <Alert variant="warning" inline className="mt-1" title={item.viagem.avisoFrotaIndisponivel}>
                  Frota indisponível
                </Alert>
              )}
              {item.viagem.avisoFrotaProdutoIncompativel && (
                <Alert variant="warning" inline className="mt-1" title={item.viagem.avisoFrotaProdutoIncompativel}>
                  Frota de outro produto
                </Alert>
              )}
            </div>
            <BaixarOrdemDeViagem viagemId={item.viagem.id} />
          </div>

          <MotoristaCelula item={item} />

          <div className="flex flex-wrap items-center gap-2">
            <StatusCelula item={item} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Início previsto</dt>
              <dd className="font-mono font-medium tabular-nums text-foreground">{formatarDataHoraPtBr(item.viagem.inicioPrevisto)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Saída real</dt>
              <dd>
                <SaidaCelula item={item} />
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-muted-foreground">Destinos</p>
            <RotaDestinos entregas={entregasDaViagem(item)} className="px-0 text-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}
