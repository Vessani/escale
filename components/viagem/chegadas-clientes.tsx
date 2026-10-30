"use client"

import { useEffect, useState, useSyncExternalStore, useTransition } from "react"
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
import type { EntradaChegada, EntradaEntregaVista } from "@/lib/validation/chegada"
import {
  apagarRascunho,
  chaveDoRascunho,
  criarLeitorRascunhos,
  salvarRascunho,
  type CampoTextoChegada,
  type CamposRascunho,
  type RascunhoChegada,
} from "@/lib/rascunho-chegada"

/** Grava a chegada de uma entrega — a action do motorista ou a do escalador (correção). */
/** Recebe a entrega como estava na tela quando a chegada foi aberta (não a da última atualização). */
type SalvarChegada = (entrega: EntradaEntregaVista, dados: EntradaChegada) => Promise<RespostaAcao>

type Produto = "CO2" | "NITROGENIO" | "ARGONIO" | "BIOMETANO" | "OXIGENIO" | "GNL"

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

/** O rascunho só é lido ao abrir a tela — nada muda depois sem a própria tela saber. */
const semInscricao = () => () => {}

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

/**
 * Campos ao abrir a chegada: vazios na nova (data e hora = agora, pelo relógio
 * do servidor, horário de Brasília — não o do celular, que pode estar em
 * outro fuso ou adiantado); os da chegada registrada na correção.
 */
function camposIniciais(anterior: ChegadaDoPainel | null, biometano: boolean, agoraServidor: string): CamposRascunho {
  // Chegadas antigas (uma leitura só, em nivelInicial/Final): manômetro vira
  // a linha pol, balança a linha kg. GRADE (08–09/10) não tinha medida: escolher de novo.
  const manometroAntigo = !biometano && anterior?.medicao === "MANOMETRO" && anterior.polInicial === null
  const balancaAntiga = !biometano && anterior?.medicao === "BALANCA" && (anterior.kgInicial ?? null) === null
  return {
    km: anterior ? String(anterior.km) : "",
    quando: formatDateTimeForInput(anterior ? anterior.chegadaEm : agoraServidor),
    medicao: anterior?.medicao === "MANOMETRO" || anterior?.medicao === "BALANCA" ? anterior.medicao : null,
    fator: anterior?.medicao === "MANOMETRO" ? numeroCampo(anterior.fator) : "",
    polInicial: numeroCampo(manometroAntigo ? anterior.nivelInicial : anterior?.polInicial),
    polFinal: numeroCampo(manometroAntigo ? anterior.nivelFinal : anterior?.polFinal),
    m3Inicial: numeroCampo(anterior?.m3Inicial),
    m3Final: numeroCampo(anterior?.m3Final),
    kgInicial: numeroCampo(balancaAntiga ? anterior.nivelInicial : anterior?.kgInicial),
    kgFinal: numeroCampo(balancaAntiga ? anterior.nivelFinal : anterior?.kgFinal),
    pctInicial: numeroCampo(anterior?.pctInicial),
    pctFinal: numeroCampo(anterior?.pctFinal),
    // Biometano: nível do tanque do caminhão em m³ (as polegadas usam polInicial/polFinal).
    inicial: biometano ? numeroCampo(anterior?.nivelInicial) : "",
    final: biometano ? numeroCampo(anterior?.nivelFinal) : "",
  }
}

function FormChegada({
  salvar,
  entrega,
  produto,
  kmInicial,
  agoraServidor,
  aoTerminar,
  chaveRascunho,
  rascunho,
}: {
  salvar: SalvarChegada
  entrega: EntregaDoPainel
  produto: Produto | null
  kmInicial: number | null
  agoraServidor: string
  aoTerminar: () => void
  /** Só na chegada nova do motorista: onde guardar o rascunho no celular (ver rascunho-chegada.ts). */
  chaveRascunho?: string
  /** Rascunho recuperado deste celular ao abrir a tela. */
  rascunho?: RascunhoChegada
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const anterior = entrega.chegada
  const biometano = produto === "BIOMETANO"
  // Congelada ao abrir: a tela se atualiza sozinha a cada minuto, e se o
  // escalador trocar o cliente no meio-tempo o rótulo muda, mas a medição foi
  // feita no cliente de antes — o servidor compara com isto e recusa.
  const [entregaVista] = useState<EntradaEntregaVista>(
    () => rascunho?.vista ?? { id: entrega.id, cliente: entrega.cliente, cidade: entrega.cidade, uf: entrega.uf },
  )
  // Todos os campos num estado só: é o mesmo objeto que vai pro rascunho do celular.
  const [campos, setCampos] = useState<CamposRascunho>(() => rascunho?.campos ?? camposIniciais(anterior, biometano, agoraServidor))
  const alterar = (campo: CampoTextoChegada) => (valor: string) => setCampos((atuais) => ({ ...atuais, [campo]: valor }))
  const setMedicao = (medicao: Medida | null) => setCampos((atuais) => ({ ...atuais, medicao }))
  const { km, quando, medicao, fator, polInicial, polFinal, m3Inicial, m3Final, kgInicial, kgFinal, pctInicial, pctFinal, inicial, final } =
    campos

  // Cada mudança vai pro rascunho do celular (só na chegada nova do motorista).
  useEffect(() => {
    if (chaveRascunho) salvarRascunho(chaveRascunho, entregaVista, campos)
  }, [chaveRascunho, entregaVista, campos])

  const encerrar = () => {
    if (chaveRascunho) apagarRascunho(chaveRascunho)
    aoTerminar()
  }

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
    POL: [polInicial, alterar("polInicial"), polFinal, alterar("polFinal")],
    M3: [m3Inicial, alterar("m3Inicial"), m3Final, alterar("m3Final")],
    KG: [kgInicial, alterar("kgInicial"), kgFinal, alterar("kgFinal")],
    PCT: [pctInicial, alterar("pctInicial"), pctFinal, alterar("pctFinal")],
  }

  const enviar = () => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(() => salvar(entregaVista, { km: Number(km), chegadaEm: quando, ...dados }))
      if (!resposta.sucesso) return setErro(resposta.erro)
      encerrar()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 border-t pt-3">
      {erro && <Alert variant="error">{erro}</Alert>}
      {rascunho && <Alert variant="info">Recuperamos o que você tinha digitado neste celular. Confira e toque em Registrar chegada.</Alert>}
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Km na chegada
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder={kmInicial !== null ? `≥ ${kmInicial}` : undefined}
            value={km}
            onChange={(e) => alterar("km")(e.target.value.replace(/\D/g, "").slice(0, 7))}
            className="h-11 text-base tabular-nums text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Data e hora
          <Input
            type="datetime-local"
            value={quando}
            onChange={(e) => alterar("quando")(e.target.value)}
            className="h-11 text-sm text-foreground"
          />
        </label>
      </div>

      {biometano ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <CampoNumero rotulo="Nível inicial" valor={polInicial} onChange={alterar("polInicial")} sufixo="pol" />
            <CampoNumero rotulo="Nível final" valor={polFinal} onChange={alterar("polFinal")} sufixo="pol" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CampoNumero rotulo="Nível inicial" valor={inicial} onChange={alterar("inicial")} sufixo="m³" />
            <CampoNumero rotulo="Nível final" valor={final} onChange={alterar("final")} sufixo="m³" />
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
              {medicao === "MANOMETRO" && <CampoNumero rotulo="Conversão do cliente" valor={fator} onChange={alterar("fator")} />}
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
        {/* Abriu o cliente errado ou desistiu: fecha sem gravar (abrir outro não fecha mais este). */}
        <Button type="button" variant="ghost" className="h-12" onClick={encerrar} disabled={pendente}>
          Cancelar
        </Button>
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
  chaveViagemRascunho,
}: {
  salvar: SalvarChegada
  entregas: EntregaDoPainel[]
  /**
   * Liga o rascunho no celular (área do motorista): identifica motorista e
   * viagem na chave, pra um rascunho nunca aparecer pra outro motorista no
   * mesmo aparelho. Sem isto (correção do escalador), não guarda rascunho.
   */
  chaveViagemRascunho?: string
  /** Botões extras ao lado do "corrigir" de uma chegada registrada (ex: o escalador apagar). */
  acoes?: (entrega: EntregaDoPainel) => React.ReactNode
  produto: Produto | null
  kmInicial: number | null
  agoraServidor: string
}) {
  // Várias abertas ao mesmo tempo: abrir o próximo cliente NÃO fecha o
  // anterior — antes, abrir a 2ª entrega descartava sem aviso o que o
  // motorista já tinha digitado na 1ª e não tinha registrado.
  const [abertas, setAbertas] = useState<ReadonlySet<number>>(new Set())
  const abrir = (id: number) => setAbertas((atuais) => new Set(atuais).add(id))
  // Rascunho recuperado já registrado ou cancelado: não volta ao abrir de novo.
  const [descartados, setDescartados] = useState<ReadonlySet<number>>(new Set())
  const fechar = (id: number) => {
    setAbertas((atuais) => {
      const novas = new Set(atuais)
      novas.delete(id)
      return novas
    })
    setDescartados((atuais) => new Set(atuais).add(id))
  }

  // Ao abrir a tela: as chegadas que ficaram pela metade neste celular voltam
  // abertas e preenchidas (lidas uma vez, ver criarLeitorRascunhos).
  const [leitor] = useState(() => criarLeitorRascunhos(chaveViagemRascunho, entregas))
  const recuperados = useSyncExternalStore(semInscricao, leitor.ler, leitor.noServidor)
  const estaAberta = (id: number) => abertas.has(id) || (recuperados.has(id) && !descartados.has(id))

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
            {!entrega.chegada && estaAberta(entrega.id) && (
              <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Não registrada</span>
            )}
            {entrega.chegada && !estaAberta(entrega.id) && (
              <span className="flex shrink-0 items-center gap-1">
                <CircleCheck className="size-4 text-success" aria-label="Chegada registrada" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Corrigir chegada em ${entrega.cliente}`}
                  onClick={() => abrir(entrega.id)}
                >
                  <Pencil className="size-4 text-muted-foreground" aria-hidden />
                </Button>
                {acoes?.(entrega)}
              </span>
            )}
          </div>

          {estaAberta(entrega.id) ? (
            <FormChegada
              salvar={salvar}
              entrega={entrega}
              produto={produto}
              kmInicial={kmInicial}
              agoraServidor={agoraServidor}
              aoTerminar={() => fechar(entrega.id)}
              chaveRascunho={chaveViagemRascunho && !entrega.chegada ? chaveDoRascunho(chaveViagemRascunho, entrega.id) : undefined}
              rascunho={entrega.chegada || descartados.has(entrega.id) ? undefined : recuperados.get(entrega.id)}
            />
          ) : entrega.chegada ? (
            <div className="mt-2">
              <ResumoChegada chegada={entrega.chegada} />
            </div>
          ) : (
            <Button type="button" variant="outline" className="mt-2 h-11 w-full" onClick={() => abrir(entrega.id)}>
              Registrar chegada
            </Button>
          )}
        </li>
      ))}
    </ol>
  )
}
