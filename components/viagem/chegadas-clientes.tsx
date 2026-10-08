"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, MapPin, Pencil } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ControleSegmentado } from "@/components/ui/controle-segmentado"
import { chamarAcao } from "@/lib/chamar-acao"
import {
  FATOR_BALANCA,
  calcularDescarga,
  formatarNumero,
  parseNumeroDecimal,
  unidadeDescarga,
  type TipoMedicao,
} from "@/lib/services/descarga"
import { formatDateTimeForInput, formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import type { RespostaAcao } from "@/lib/types/types"
import type { EntradaChegada } from "@/lib/validation/chegada"

/** Grava a chegada de uma entrega — a action do motorista ou a do escalador (correção). */
type SalvarChegada = (entregaId: number, dados: EntradaChegada) => Promise<RespostaAcao>

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

export type EntregaDoPainel = {
  id: number
  cliente: string
  cidade: string
  uf: string
  chegada: (ChegadaDoPainel & { id?: number }) | null
}

const ROTULO_MEDICAO: Record<TipoMedicao, string> = { MANOMETRO: "Manômetro", BALANCA: "Balança" }

const numeroCampo = (valor: number | null | undefined) => (valor === null || valor === undefined ? "" : String(valor).replace(".", ","))

function CampoNumero({
  rotulo,
  valor,
  onChange,
  sufixo,
}: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
  sufixo?: string
}) {
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
        {sufixo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">
            {sufixo}
          </span>
        )}
      </div>
    </label>
  )
}

function FormChegada({
  salvar,
  entrega,
  produto,
  kmInicial,
  agoraServidor,
  aoTerminar,
}: {
  salvar: SalvarChegada
  entrega: EntregaDoPainel
  produto: Produto | null
  kmInicial: number | null
  agoraServidor: string
  aoTerminar: () => void
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const anterior = entrega.chegada
  const biometano = produto === "BIOMETANO"

  const [km, setKm] = useState(anterior ? String(anterior.km) : "")
  // Horário de Brasília (como o resto do sistema), a partir do relógio do
  // servidor — não do celular, que pode estar em outro fuso ou adiantado.
  const [quando, setQuando] = useState(() => formatDateTimeForInput(anterior ? anterior.chegadaEm : agoraServidor))
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
    fatorCliente: medicao === "MANOMETRO" ? parseNumeroDecimal(fator, { pontoDecimal: true }) : null,
    polInicial: biometano ? parseNumeroDecimal(polInicial) : null,
    polFinal: biometano ? parseNumeroDecimal(polFinal) : null,
  }
  const resultado = calcularDescarga({ ...dados, produto })
  const preenchido = inicial && final && (biometano ? polInicial && polFinal : medicao && (medicao === "BALANCA" || fator))

  const enviar = () => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => salvar(entrega.id, { km: Number(km), chegadaEm: quando, ...dados }))
      if (!resposta.sucesso) return setErro(resposta.erro)
      aoTerminar()
      router.refresh()
    })
  }

  const unidadeLeitura = biometano ? "m³" : medicao === "BALANCA" ? "kg" : "pol"

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
          <Input
            type="datetime-local"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            className="h-11 text-sm text-foreground"
          />
        </label>
      </div>

      {!biometano && (
        <ControleSegmentado
          rotulo="Tipo de medida"
          largo
          opcoes={(["MANOMETRO", "BALANCA"] as const).map((tipo) => ({ valor: tipo, rotulo: ROTULO_MEDICAO[tipo] }))}
          valor={medicao}
          onChange={setMedicao}
        />
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
            <>
              <p className="text-xs text-muted-foreground">
                Manômetro do tanque do cliente: o nível sobe com a descarga (final maior que o inicial).
              </p>
              <CampoNumero rotulo="Conversão do cliente" valor={fator} onChange={setFator} />
            </>
          )}
          {medicao === "BALANCA" && !biometano && (
            <p className="text-xs text-muted-foreground">Balança: o peso sobe com a descarga (final maior que o inicial).</p>
          )}
          {medicao === "BALANCA" && produto && produto !== "BIOMETANO" && (
            <p className="text-xs text-muted-foreground">
              Conversão do produto:{" "}
              {FATOR_BALANCA[produto] === 1 ? "sem conversão (fica em kg)" : `× ${formatarNumero(FATOR_BALANCA[produto], 4)}`}
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
          onClick={enviar}
        >
          {pendente ? "Salvando..." : anterior ? "Salvar correção" : "Registrar chegada"}
        </Button>
      </div>
    </div>
  )
}

function ResumoChegada({ chegada }: { chegada: ChegadaDoPainel }) {
  const unidade = unidadeDescarga(chegada) ? ` ${unidadeDescarga(chegada)}` : ""
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <dt className="text-xs text-muted-foreground">Chegou</dt>
        <dd className="font-semibold tabular-nums">
          {formatarDataHoraPtBr(chegada.chegadaEm).slice(0, 5)} {formatarDataHoraPtBr(chegada.chegadaEm).slice(-5)}
        </dd>
      </div>
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <dt className="text-xs text-muted-foreground">Km</dt>
        <dd className="font-semibold tabular-nums">{chegada.km}</dd>
      </div>
      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <dt className="text-xs text-muted-foreground">{chegada.medicao ? ROTULO_MEDICAO[chegada.medicao] : "Descarregado"}</dt>
        <dd className="font-semibold tabular-nums">
          {formatarNumero(chegada.totalDescarregado)}
          {unidade}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Uma linha por cliente da rota: registrar a chegada (km, hora, medição) e
 * ver o que já foi registrado. Usado pelo motorista (celular) e pelo
 * escalador na edição da viagem (correção).
 */
export function ChegadasClientes({
  salvar,
  entregas,
  produto,
  kmInicial,
  agoraServidor,
  acoes,
}: {
  salvar: SalvarChegada
  entregas: EntregaDoPainel[]
  /** Botões extras ao lado do "corrigir" de uma chegada registrada (ex: o escalador apagar). */
  acoes?: (entrega: EntregaDoPainel) => React.ReactNode
  produto: Produto | null
  kmInicial: number | null
  agoraServidor: string
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Corrigir chegada em ${entrega.cliente}`}
                  onClick={() => setAberta(entrega.id)}
                >
                  <Pencil className="size-4 text-muted-foreground" aria-hidden />
                </Button>
                {acoes?.(entrega)}
              </span>
            )}
          </div>

          {aberta === entrega.id ? (
            <FormChegada
              salvar={salvar}
              entrega={entrega}
              produto={produto}
              kmInicial={kmInicial}
              agoraServidor={agoraServidor}
              aoTerminar={() => setAberta(null)}
            />
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
