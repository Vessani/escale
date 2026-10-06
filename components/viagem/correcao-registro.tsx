"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BedDouble, Pencil, Plus, Ticket, Trash2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { BotaoIcone } from "@/components/ui/botao-icone"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ControleSegmentado } from "@/components/ui/controle-segmentado"
import { Input } from "@/components/ui/input"
import { ApagarChegadaBotao } from "@/components/viagem/apagar-chegada-botao"
import { ChegadasClientes, type EntregaDoPainel } from "@/components/viagem/chegadas-clientes"
import {
  corrigirDespesa,
  corrigirKm,
  lancarDespesaEscalador,
  removerDespesaEscalador,
  salvarChegadaEscalador,
} from "@/lib/actions/correcao-registro"
import { chamarAcao } from "@/lib/chamar-acao"
import { formatarReais, parseReaisParaCentavos, reaisNoCampo } from "@/lib/utils/dinheiro"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import type { RespostaAcao } from "@/lib/types/types"

/**
 * Correções do escalador no que o motorista registrou (edição da viagem):
 * km, pedágio/pernoite e chegadas. Também com a viagem já encerrada.
 */

type TipoDespesa = "PEDAGIO" | "PERNOITE"
const ROTULO_DESPESA: Record<TipoDespesa, string> = { PEDAGIO: "Pedágio", PERNOITE: "Pernoite" }

/** Chama a action, mostra o erro ou recarrega a tela. */
function useCorrecao() {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const executar = (acao: () => Promise<RespostaAcao>, aoTerminar?: () => void) => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(acao)
      if (!resposta.sucesso) return setErro(resposta.erro)
      aoTerminar?.()
      router.refresh()
    })
  }
  return { pendente, erro, setErro, executar }
}

const apenasDigitos = (texto: string) => texto.replace(/\D/g, "").slice(0, 7)

export function CorrigirKm({
  viagemId,
  kmInicial,
  kmFinal,
  encerrada,
}: {
  viagemId: number
  kmInicial: number | null
  kmFinal: number | null
  encerrada: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [inicial, setInicial] = useState(kmInicial?.toString() ?? "")
  const [final, setFinal] = useState(kmFinal?.toString() ?? "")
  const { pendente, erro, setErro, executar } = useCorrecao()

  if (!aberto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Pencil className="mr-1.5 size-3.5" aria-hidden /> Corrigir km
      </Button>
    )
  }

  const fechar = () => {
    setAberto(false)
    setErro("")
    setInicial(kmInicial?.toString() ?? "")
    setFinal(kmFinal?.toString() ?? "")
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {erro && <Alert variant="error">{erro}</Alert>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Km inicial
          <Input
            inputMode="numeric"
            value={inicial}
            onChange={(e) => setInicial(apenasDigitos(e.target.value))}
            className="h-9 w-36 tabular-nums"
          />
        </label>
        {encerrada && (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Km final
            <Input
              inputMode="numeric"
              value={final}
              onChange={(e) => setFinal(apenasDigitos(e.target.value))}
              className="h-9 w-36 tabular-nums"
            />
          </label>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={fechar} disabled={pendente}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pendente || !inicial || (encerrada && !final)}
          onClick={() =>
            executar(
              () => corrigirKm(viagemId, { kmInicial: Number(inicial), kmFinal: encerrada ? Number(final) : null }),
              () => setAberto(false),
            )
          }
        >
          {pendente ? "Salvando..." : "Salvar km"}
        </Button>
      </div>
      {!encerrada && <p className="text-xs text-muted-foreground">O km final é lançado quando a viagem é encerrada.</p>}
    </div>
  )
}

function FormDespesa({
  inicial,
  aoSalvar,
  aoCancelar,
  pendente,
  rotuloSalvar,
}: {
  inicial?: { tipo: TipoDespesa; valorCentavos: number }
  aoSalvar: (dados: { tipo: TipoDespesa; valorCentavos: number }) => void
  aoCancelar: () => void
  pendente: boolean
  rotuloSalvar: string
}) {
  const [tipo, setTipo] = useState<TipoDespesa>(inicial?.tipo ?? "PEDAGIO")
  const [valor, setValor] = useState(inicial ? reaisNoCampo(inicial.valorCentavos) : "")
  const centavos = parseReaisParaCentavos(valor)
  return (
    <div className="flex flex-wrap items-end gap-2 px-3 py-2">
      <ControleSegmentado
        rotulo="Tipo de despesa"
        opcoes={(["PEDAGIO", "PERNOITE"] as const).map((t) => ({ valor: t, rotulo: ROTULO_DESPESA[t] }))}
        valor={tipo}
        onChange={setTipo}
      />
      <label className="grid gap-1 text-xs text-muted-foreground">
        Valor (R$)
        <Input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className="h-9 w-32 tabular-nums"
        />
      </label>
      <Button type="button" variant="ghost" size="sm" onClick={aoCancelar} disabled={pendente}>
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pendente || centavos === null}
        onClick={() => centavos !== null && aoSalvar({ tipo, valorCentavos: centavos })}
      >
        {pendente ? "Salvando..." : rotuloSalvar}
      </Button>
    </div>
  )
}

type Despesa = { id: number; tipo: TipoDespesa; valorCentavos: number; registradoEm: string }

export function DespesasEditaveis({ viagemId, despesas }: { viagemId: number; despesas: Despesa[] }) {
  const [editando, setEditando] = useState<number | "nova" | null>(null)
  const [apagar, setApagar] = useState<Despesa | null>(null)
  const { pendente, erro, setErro, executar } = useCorrecao()

  return (
    <div className="space-y-2">
      {erro && !apagar && <Alert variant="error">{erro}</Alert>}
      <ul className="divide-y rounded-lg border text-sm">
        {despesas.length === 0 && editando !== "nova" && (
          <li className="px-3 py-2 text-muted-foreground">Nenhum pedágio ou pernoite lançado.</li>
        )}
        {despesas.map((despesa) =>
          editando === despesa.id ? (
            <li key={despesa.id}>
              <FormDespesa
                inicial={despesa}
                pendente={pendente}
                rotuloSalvar="Salvar correção"
                aoCancelar={() => setEditando(null)}
                aoSalvar={(dados) =>
                  executar(
                    () => corrigirDespesa(despesa.id, dados),
                    () => setEditando(null),
                  )
                }
              />
            </li>
          ) : (
            <li key={despesa.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="flex items-center gap-2">
                {despesa.tipo === "PEDAGIO" ? (
                  <Ticket className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <BedDouble className="size-4 text-muted-foreground" aria-hidden />
                )}
                {ROTULO_DESPESA[despesa.tipo]}
                <span className="text-xs text-muted-foreground">{formatarDataHoraPtBr(despesa.registradoEm)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="mr-1 font-medium tabular-nums">{formatarReais(despesa.valorCentavos)}</span>
                <BotaoIcone
                  rotulo={`Corrigir ${ROTULO_DESPESA[despesa.tipo].toLowerCase()}`}
                  icone={Pencil}
                  onClick={() => {
                    setErro("")
                    setEditando(despesa.id)
                  }}
                />
                <BotaoIcone
                  rotulo={`Apagar ${ROTULO_DESPESA[despesa.tipo].toLowerCase()}`}
                  icone={Trash2}
                  perigo
                  onClick={() => {
                    setErro("")
                    setApagar(despesa)
                  }}
                />
              </span>
            </li>
          ),
        )}
        {editando === "nova" && (
          <li>
            <FormDespesa
              pendente={pendente}
              rotuloSalvar="Lançar"
              aoCancelar={() => setEditando(null)}
              aoSalvar={(dados) =>
                executar(
                  () => lancarDespesaEscalador(viagemId, dados),
                  () => setEditando(null),
                )
              }
            />
          </li>
        )}
      </ul>
      {editando === null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setErro("")
            setEditando("nova")
          }}
        >
          <Plus className="mr-1.5 size-3.5" aria-hidden /> Lançar pedágio ou pernoite
        </Button>
      )}
      <ConfirmDialog
        open={apagar !== null}
        onOpenChange={(aberto) => !aberto && setApagar(null)}
        title={apagar ? `Apagar ${ROTULO_DESPESA[apagar.tipo].toLowerCase()} de ${formatarReais(apagar.valorCentavos)}?` : ""}
        description="O lançamento sai da viagem e dos relatórios (fica no histórico)."
        confirmLabel="Apagar"
        confirmingLabel="Apagando..."
        confirming={pendente}
        erro={apagar ? erro || null : null}
        onConfirm={() =>
          apagar &&
          executar(
            () => removerDespesaEscalador(apagar.id),
            () => setApagar(null),
          )
        }
      />
    </div>
  )
}

type Produto = "CO2" | "NITROGENIO" | "ARGONIO" | "BIOMETANO" | "OXIGENIO"

export function ChegadasEditaveis({
  entregas,
  produto,
  kmInicial,
  agoraServidor,
}: {
  entregas: EntregaDoPainel[]
  produto: Produto | null
  kmInicial: number | null
  agoraServidor: string
}) {
  if (entregas.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhum cliente com SAP code e número white nesta viagem.</p>
  return (
    <div className="[&>ol]:grid [&>ol]:gap-2 [&>ol]:space-y-0 md:[&>ol]:grid-cols-2">
      <ChegadasClientes
        salvar={salvarChegadaEscalador}
        entregas={entregas}
        produto={produto}
        kmInicial={kmInicial}
        agoraServidor={agoraServidor}
        acoes={(entrega) => (entrega.chegada?.id ? <ApagarChegadaBotao chegadaId={entrega.chegada.id} cliente={entrega.cliente} /> : null)}
      />
    </div>
  )
}
