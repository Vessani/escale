"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, MapPin, Pencil } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { registrarChegada } from "@/lib/actions/minhas-viagens"
import { chamarAcao } from "@/lib/chamar-acao"
import { FATOR_BALANCA, calcularDescarga, formatarNumero, parseNumeroDecimal, type TipoMedicao } from "@/lib/services/descarga"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

type Produto = "CO2" | "NITROGENIO" | "ARGONIO" | "BIOMETANO" | "OXIGENIO"

export type ChegadaDoPainel = {
  km: number
  chegadaEm: string
  medicao: TipoMedicao | null
  nivelInicial: number
  nivelFinal: number
  polInicial: number | null
  polFinal: number | null
  fator: number | null
  totalDescarregado: number
}

export type EntregaDoPainel = { id: number; cliente: string; cidade: string; uf: string; chegada: ChegadaDoPainel | null }

const ROTULO_MEDICAO: Record<TipoMedicao, string> = { MANOMETRO: "Manômetro", BALANCA: "Balança" }

/** "YYYY-MM-DDTHH:MM" no fuso do celular (o do motorista), pro <input type="datetime-local">. */
function paraCampoDataHora(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`
}

const numeroCampo = (valor: number | null | undefined) => (valor === null || valor === undefined ? "" : String(valor).replace(".", ","))

function CampoNumero({ rotulo, valor, onChange, sufixo }: { rotulo: string; valor: string; onChange: (v: string) => void; sufixo?: string }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {rotulo}
      <div className="relative">
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className={cn("h-11 text-base tabular-nums text-foreground", sufixo && "pr-12")}
        />
        {sufixo && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">{sufixo}</span>}
      </div>
    </label>
  )
}

function FormChegada({
  viagemId,
  entrega,
  produto,
  kmInicial,
  aoTerminar,
}: {
  viagemId: number
  entrega: EntregaDoPainel
  produto: Produto | null
  kmInicial: number | null
  aoTerminar: () => void
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const anterior = entrega.chegada
  const biometano = produto === "BIOMETANO"

  const [km, setKm] = useState(anterior ? String(anterior.km) : "")
  const [quando, setQuando] = useState(() => paraCampoDataHora(anterior ? new Date(anterior.chegadaEm) : new Date()))
  const [medicao, setMedicao] = useState<TipoMedicao | null>(anterior?.medicao ?? null)
  const [inicial, setInicial] = useState(numeroCampo(anterior?.nivelInicial))
  const [final, setFinal] = useState(numeroCampo(anterior?.nivelFinal))
  const [fator, setFator] = useState(anterior?.medicao === "MANOMETRO" ? numeroCampo(anterior.fator) : "")
  const [polInicial, setPolInicial] = useState(numeroCampo(anterior?.polInicial))
  const [polFinal, setPolFinal] = useState(numeroCampo(anterior?.polFinal))

  const dados = {
    medicao: biometano ? null : medicao,
    nivelInicial: parseNumeroDecimal(inicial),
    nivelFinal: parseNumeroDecimal(final),
    fatorCliente: medicao === "MANOMETRO" ? parseNumeroDecimal(fator) : null,
    polInicial: biometano ? parseNumeroDecimal(polInicial) : null,
    polFinal: biometano ? parseNumeroDecimal(polFinal) : null,
  }
  const resultado = calcularDescarga({ ...dados, produto })
  const preenchido = inicial && final && (biometano ? polInicial && polFinal : medicao && (medicao === "BALANCA" || fator))

  const salvar = () => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() =>
        registrarChegada(viagemId, entrega.id, { km: Number(km), chegadaEm: new Date(quando).toISOString(), ...dados }),
      )
      if (!resposta.sucesso) return setErro(resposta.erro)
      aoTerminar()
      router.refresh()
    })
  }

  const unidadeLeitura = biometano ? "m³" : medicao === "BALANCA" ? "kg" : undefined

  return (
    <div className="space-y-3 border-t pt-3">
      {erro && <Alert variant="error">{erro}</Alert>}
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Km na chegada
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder={kmInicial !== null ? `≥ ${kmInicial}` : undefined}
            value={km}
            onChange={(e) => setKm(e.target.value.replace(/\D/g, "").slice(0, 7))}
            className="h-11 text-base tabular-nums text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Data e hora
          <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="h-11 text-sm text-foreground" />
        </label>
      </div>

      {!biometano && (
        <div className="inline-flex w-full rounded-lg border bg-muted/40 p-1" role="group" aria-label="Tipo de medida">
          {(["MANOMETRO", "BALANCA"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              aria-pressed={medicao === tipo}
              onClick={() => setMedicao(tipo)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm transition-colors",
                medicao === tipo ? "bg-background font-medium shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              {ROTULO_MEDICAO[tipo]}
            </button>
          ))}
        </div>
      )}

      {(biometano || medicao) && (
        <>
          {biometano && (
            <div className="grid grid-cols-2 gap-2">
              <CampoNumero rotulo="Nível inicial" valor={polInicial} onChange={setPolInicial} sufixo="pol" />
              <CampoNumero rotulo="Nível final" valor={polFinal} onChange={setPolFinal} sufixo="pol" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <CampoNumero rotulo="Nível inicial" valor={inicial} onChange={setInicial} sufixo={unidadeLeitura} />
            <CampoNumero rotulo="Nível final" valor={final} onChange={setFinal} sufixo={unidadeLeitura} />
          </div>
          {medicao === "MANOMETRO" && !biometano && (
            <CampoNumero rotulo="Conversão do cliente" valor={fator} onChange={setFator} />
          )}
          {medicao === "BALANCA" && produto && produto !== "BIOMETANO" && (
            <p className="text-xs text-muted-foreground">
              Conversão do produto: {FATOR_BALANCA[produto] === 1 ? "sem conversão (fica em kg)" : `× ${formatarNumero(FATOR_BALANCA[produto], 4)}`}
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
            <span className="text-sm text-muted-foreground">Total descarregado</span>
            <span className="text-lg font-semibold tabular-nums">
              {preenchido && resultado.ok ? `${formatarNumero(resultado.total)}${resultado.unidade ? ` ${resultado.unidade}` : ""}` : "—"}
            </span>
          </div>
          {preenchido && !resultado.ok && <p className="text-sm text-destructive">{resultado.erro}</p>}
        </>
      )}

      <div className="flex gap-2">
        {anterior && (
          <Button type="button" variant="ghost" className="h-12" onClick={aoTerminar} disabled={pendente}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          className="h-12 flex-1 text-base"
          disabled={pendente || !km || !quando || !preenchido || !resultado.ok}
          onClick={salvar}
        >
          {pendente ? "Salvando..." : anterior ? "Salvar correção" : "Registrar chegada"}
        </Button>
      </div>
    </div>
  )
}

function ResumoChegada({ chegada }: { chegada: ChegadaDoPainel }) {
  const unidade = chegada.medicao === "MANOMETRO" ? "" : chegada.medicao === "BALANCA" && chegada.fator === 1 ? " kg" : " m³"
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <dt className="text-xs text-muted-foreground">Chegou</dt>
        <dd className="font-semibold tabular-nums">{formatarDataHoraPtBr(chegada.chegadaEm).slice(0, 5)} {formatarDataHoraPtBr(chegada.chegadaEm).slice(-5)}</dd>
      </div>
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <dt className="text-xs text-muted-foreground">Km</dt>
        <dd className="font-semibold tabular-nums">{chegada.km}</dd>
      </div>
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <dt className="text-xs text-muted-foreground">{chegada.medicao ? ROTULO_MEDICAO[chegada.medicao] : "Descarregado"}</dt>
        <dd className="font-semibold tabular-nums">{formatarNumero(chegada.totalDescarregado)}{unidade}</dd>
      </div>
    </dl>
  )
}

/** Uma linha por cliente da rota: registrar a chegada (km, hora, medição) e ver o que já foi registrado. */
export function ChegadasClientes({
  viagemId,
  entregas,
  produto,
  kmInicial,
}: {
  viagemId: number
  entregas: EntregaDoPainel[]
  produto: Produto | null
  kmInicial: number | null
}) {
  const [aberta, setAberta] = useState<number | null>(null)

  return (
    <ol className="space-y-2">
      {entregas.map((entrega, indice) => (
        <li key={entrega.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{indice + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entrega.cliente}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" aria-hidden /> {entrega.cidade}/{entrega.uf}
                </p>
              </div>
            </div>
            {entrega.chegada && aberta !== entrega.id && (
              <span className="flex shrink-0 items-center gap-1">
                <CircleCheck className="size-4 text-success" aria-label="Chegada registrada" />
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Corrigir chegada em ${entrega.cliente}`} onClick={() => setAberta(entrega.id)}>
                  <Pencil className="size-4 text-muted-foreground" aria-hidden />
                </Button>
              </span>
            )}
          </div>

          {aberta === entrega.id ? (
            <FormChegada viagemId={viagemId} entrega={entrega} produto={produto} kmInicial={kmInicial} aoTerminar={() => setAberta(null)} />
          ) : entrega.chegada ? (
            <div className="mt-2">
              <ResumoChegada chegada={entrega.chegada} />
            </div>
          ) : (
            <Button type="button" variant="outline" className="mt-2 h-11 w-full" onClick={() => setAberta(entrega.id)}>
              Registrar chegada
            </Button>
          )}
        </li>
      ))}
    </ol>
  )
}
