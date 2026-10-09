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
  NOME_LINHA,
  unidadeDescarga,
  type LinhaMedicao,
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
  m3Inicial?: number | null
  m3Final?: number | null
  kgInicial?: number | null
  kgFinal?: number | null
  pctInicial?: number | null
  pctFinal?: number | null
}

export type EntregaDoPainel = {
  id: number
  cliente: string
  cidade: string
  uf: string
  chegada: (ChegadaDoPainel & { id?: number }) | null
}

type Medida = "MANOMETRO" | "BALANCA"
const ROTULO_MEDIDA: Record<Medida, string> = { MANOMETRO: "Manômetro", BALANCA: "Balança" }
/** A linha que dá o total vem primeiro. */
const ORDEM_LINHAS: Record<Medida, LinhaMedicao[]> = { MANOMETRO: ["POL", "M3", "KG", "PCT"], BALANCA: ["KG", "M3", "POL", "PCT"] }
const LINHA_DO_TOTAL: Record<Medida, LinhaMedicao> = { MANOMETRO: "POL", BALANCA: "KG" }

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

/** Campo da grade: sem rótulo próprio (a linha e a coluna dizem o que é). */
function CampoGrade({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <Input
      aria-label={rotulo}
      inputMode="decimal"
      autoComplete="off"
      value={valor}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      className="h-11 px-2 text-base tabular-nums text-foreground"
    />
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
  // Chegadas antigas (uma leitura só, em nivelInicial/Final): manômetro vira
  // a linha pol, balança a linha kg. GRADE (08–09/10) não tinha medida: escolher de novo.
  const medidaAnterior = anterior?.medicao === "MANOMETRO" || anterior?.medicao === "BALANCA" ? anterior.medicao : null
  const manometroAntigo = !biometano && anterior?.medicao === "MANOMETRO" && anterior.polInicial === null
  const balancaAntiga = !biometano && anterior?.medicao === "BALANCA" && (anterior.kgInicial ?? null) === null
  const [medicao, setMedicao] = useState<Medida | null>(medidaAnterior)
  const [fator, setFator] = useState(anterior?.medicao === "MANOMETRO" ? numeroCampo(anterior.fator) : "")
  const [polInicial, setPolInicial] = useState(numeroCampo(manometroAntigo ? anterior.nivelInicial : anterior?.polInicial))
  const [polFinal, setPolFinal] = useState(numeroCampo(manometroAntigo ? anterior.nivelFinal : anterior?.polFinal))
  const [m3Inicial, setM3Inicial] = useState(numeroCampo(anterior?.m3Inicial))
  const [m3Final, setM3Final] = useState(numeroCampo(anterior?.m3Final))
  const [kgInicial, setKgInicial] = useState(numeroCampo(balancaAntiga ? anterior.nivelInicial : anterior?.kgInicial))
  const [kgFinal, setKgFinal] = useState(numeroCampo(balancaAntiga ? anterior.nivelFinal : anterior?.kgFinal))
  const [pctInicial, setPctInicial] = useState(numeroCampo(anterior?.pctInicial))
  const [pctFinal, setPctFinal] = useState(numeroCampo(anterior?.pctFinal))
  // Biometano: nível do tanque do caminhão em m³ (as polegadas usam polInicial/polFinal).
  const [inicial, setInicial] = useState(biometano ? numeroCampo(anterior?.nivelInicial) : "")
  const [final, setFinal] = useState(biometano ? numeroCampo(anterior?.nivelFinal) : "")

  const linha = (texto: string) => (biometano ? null : parseNumeroDecimal(texto))
  const dados = {
    medicao: biometano ? null : medicao,
    fatorCliente: !biometano && medicao === "MANOMETRO" ? parseNumeroDecimal(fator, { pontoDecimal: true }) : null,
    polInicial: parseNumeroDecimal(polInicial),
    polFinal: parseNumeroDecimal(polFinal),
    m3Inicial: linha(m3Inicial),
    m3Final: linha(m3Final),
    kgInicial: linha(kgInicial),
    kgFinal: linha(kgFinal),
    pctInicial: linha(pctInicial),
    pctFinal: linha(pctFinal),
    nivelInicial: biometano ? parseNumeroDecimal(inicial) : null,
    nivelFinal: biometano ? parseNumeroDecimal(final) : null,
  }
  const resultado = calcularDescarga({ ...dados, produto })
  const preenchido = biometano
    ? inicial && final && polInicial && polFinal
    : medicao && [polInicial, polFinal, m3Inicial, m3Final, kgInicial, kgFinal, pctInicial, pctFinal].some(Boolean)
  const linhas = resultado.ok ? resultado.linhas : null
  const fatorProduto = produto && produto !== "BIOMETANO" ? FATOR_BALANCA[produto] : null

  const descarregadoDaLinha = (l: LinhaMedicao): string => {
    const calc = linhas && { POL: linhas.pol, M3: linhas.m3, KG: linhas.kg, PCT: linhas.pct }[l]
    return calc ? `${formatarNumero(calc.descarregado)} ${NOME_LINHA[l]}` : "—"
  }

  const camposDaLinha: Record<LinhaMedicao, [string, (v: string) => void, string, (v: string) => void]> = {
    POL: [polInicial, setPolInicial, polFinal, setPolFinal],
    M3: [m3Inicial, setM3Inicial, m3Final, setM3Final],
    KG: [kgInicial, setKgInicial, kgFinal, setKgFinal],
    PCT: [pctInicial, setPctInicial, pctFinal, setPctFinal],
  }

  const enviar = () => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => salvar(entrega.id, { km: Number(km), chegadaEm: quando, ...dados }))
      if (!resposta.sucesso) return setErro(resposta.erro)
      aoTerminar()
      router.refresh()
    })
  }

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

      {biometano ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <CampoNumero rotulo="Nível inicial" valor={polInicial} onChange={setPolInicial} sufixo="pol" />
            <CampoNumero rotulo="Nível final" valor={polFinal} onChange={setPolFinal} sufixo="pol" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CampoNumero rotulo="Nível inicial" valor={inicial} onChange={setInicial} sufixo="m³" />
            <CampoNumero rotulo="Nível final" valor={final} onChange={setFinal} sufixo="m³" />
          </div>
        </div>
      ) : (
        <>
          <ControleSegmentado
            rotulo="Tipo de medida"
            largo
            opcoes={(["MANOMETRO", "BALANCA"] as const).map((tipo) => ({ valor: tipo, rotulo: ROTULO_MEDIDA[tipo] }))}
            valor={medicao}
            onChange={setMedicao}
          />
          {anterior?.medicao === "GRADE" && !medicao && (
            <Alert variant="info">
              Esta chegada foi registrada sem o tipo de medida. Escolha manômetro ou balança e confira as leituras.
            </Alert>
          )}
          {medicao && (
            <div className="space-y-1">
              <div className="grid grid-cols-[2.25rem_1fr_1fr_minmax(0,1.3fr)] items-center gap-x-1.5 gap-y-1.5 text-xs">
                <span />
                <span className="font-medium text-muted-foreground">Inicial</span>
                <span className="font-medium text-muted-foreground">Final</span>
                <span className="text-right font-medium text-muted-foreground">Descarregado</span>
                {ORDEM_LINHAS[medicao].map((l) => {
                  const [ini, setIni, fim, setFim] = camposDaLinha[l]
                  const doTotal = LINHA_DO_TOTAL[medicao] === l
                  return (
                    <div key={l} className="contents">
                      <span className={cn("font-semibold", doTotal ? "text-foreground" : "text-muted-foreground")}>{NOME_LINHA[l]}</span>
                      <CampoGrade rotulo={`${NOME_LINHA[l]} inicial`} valor={ini} onChange={setIni} />
                      <CampoGrade rotulo={`${NOME_LINHA[l]} final`} valor={fim} onChange={setFim} />
                      <span
                        className={cn(
                          "text-right text-sm tabular-nums",
                          doTotal ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {descarregadoDaLinha(l)}
                        {l === "KG" && linhas?.kg && fatorProduto !== 1 && (
                          <span className="block text-xs font-normal whitespace-nowrap text-muted-foreground">
                            = {formatarNumero(linhas.kg.convertido)} m³
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Vale a linha {medicao === "MANOMETRO" ? "pol × conversão do cliente" : "kg"}; as outras são opcionais. kg = peso do caminhão
                (cai); pol, m³ e % = tanque do cliente (sobem).
                {fatorProduto !== null &&
                  (fatorProduto === 1 ? " kg sem conversão (CO2)." : ` kg → m³: × ${formatarNumero(fatorProduto, 4)}.`)}
              </p>
              {medicao === "MANOMETRO" && <CampoNumero rotulo="Conversão do cliente" valor={fator} onChange={setFator} />}
            </div>
          )}
        </>
      )}

      {(biometano || medicao) && (
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
          <span className="text-sm text-muted-foreground">Total descarregado</span>
          <span className="text-lg font-semibold tabular-nums">
            {preenchido && resultado.ok ? `${formatarNumero(resultado.total)}${resultado.unidade ? ` ${resultado.unidade}` : ""}` : "—"}
          </span>
        </div>
      )}
      {preenchido && !resultado.ok && <p className="text-sm text-destructive">{resultado.erro}</p>}

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
        <dt className="text-xs text-muted-foreground">
          {chegada.medicao === "MANOMETRO" ? "Manômetro" : chegada.medicao === "BALANCA" ? "Balança" : "Descarregado"}
        </dt>
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
