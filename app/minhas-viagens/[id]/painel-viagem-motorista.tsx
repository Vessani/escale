"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BedDouble, CircleCheck, Flag, Play, Ticket, Trash2 } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { encerrarViagem, iniciarViagem, lancarDespesa, removerDespesa } from "@/lib/actions/minhas-viagens"
import { MOTIVOS_ATRASO, MOTIVO_OUTRO, TAMANHO_MAXIMO_MOTIVO } from "@/lib/services/motivos-atraso"
import { minutosDeAtraso, saidaAtrasada } from "@/lib/services/pontualidade"
import { formatarReais, parseReaisParaCentavos } from "@/lib/utils/dinheiro"
import { formatarHoraLocal } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { chamarAcao } from "@/lib/chamar-acao"

type Status = "CRIADA" | "ALOCADA" | "INICIADA" | "RETORNANDO" | "POSTERGADA" | "FINALIZADA" | "CANCELADA"
type TipoDespesa = "PEDAGIO" | "PERNOITE"

export type ViagemDoPainel = {
  id: number
  numViagem: string
  status: Status
  inicioPrevisto: string
  horarioRealSaida: string | null
  motivoAtraso: string | null
  kmInicial: number | null
  kmFinal: number | null
  despesas: Array<{ id: number; tipo: TipoDespesa; valorCentavos: number; registradoEm: string; minha: boolean }>
}

const A_INICIAR: Status[] = ["CRIADA", "ALOCADA", "POSTERGADA"]
const EM_ANDAMENTO: Status[] = ["INICIADA", "RETORNANDO"]
const ROTULO_DESPESA: Record<TipoDespesa, string> = { PEDAGIO: "Pedágio", PERNOITE: "Pernoite" }

/** Só números no campo de km (o teclado do celular às vezes manda ponto/espaço). */
const soNumeros = (texto: string) => texto.replace(/\D/g, "").slice(0, 7)

function Cartao({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Play; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icone className="size-5 text-primary" aria-hidden />
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Totais({ despesas }: { despesas: ViagemDoPainel["despesas"] }) {
  const soma = (tipo: TipoDespesa) => despesas.filter((d) => d.tipo === tipo).reduce((total, d) => total + d.valorCentavos, 0)
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      {(["PEDAGIO", "PERNOITE"] as const).map((tipo) => (
        <div key={tipo} className="rounded-lg bg-muted/60 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{ROTULO_DESPESA[tipo]}</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(soma(tipo))}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * O que o motorista faz na viagem, pelo celular: iniciar (km inicial e, se
 * atrasado, o motivo), lançar pedágio/pernoite e encerrar (km final). Cada
 * passo grava na hora — o Dashboard do despacho acompanha.
 */
export function PainelViagemMotorista({
  viagem,
  souPrincipal,
  agoraServidor,
}: {
  viagem: ViagemDoPainel
  souPrincipal: boolean
  agoraServidor: string
}) {
  const router = useRouter()
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState("")
  const [agora, setAgora] = useState(() => new Date(agoraServidor).getTime())

  const [kmInicial, setKmInicial] = useState("")
  const [motivo, setMotivo] = useState<string | null>(null)
  const [motivoOutro, setMotivoOutro] = useState("")
  const [tipoDespesa, setTipoDespesa] = useState<TipoDespesa>("PEDAGIO")
  const [valor, setValor] = useState("")
  const [kmFinal, setKmFinal] = useState("")
  const [confirmarEncerrar, setConfirmarEncerrar] = useState(false)

  // O atraso muda com o relógio: reavalia a cada 30 s.
  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(intervalo)
  }, [])

  const executar = (acao: () => Promise<{ sucesso: true } | { sucesso: false; erro: string }>, depois?: () => void) => {
    setErro("")
    iniciarTransicao(async () => {
      const resposta = await chamarAcao(acao)
      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }
      depois?.()
      router.refresh()
    })
  }

  const minutosAtraso = minutosDeAtraso(viagem.inicioPrevisto, new Date(agora))
  const atrasada = saidaAtrasada(minutosAtraso)
  const motivoFinal = motivo === MOTIVO_OUTRO ? motivoOutro.trim() : motivo

  if (!souPrincipal) {
    return (
      <Alert variant="info">
        Você está como acompanhante nesta viagem. Quem registra saída, pedágio, pernoite e km é o motorista principal.
      </Alert>
    )
  }

  if (viagem.status === "CANCELADA") {
    return <Alert variant="warning">Esta viagem foi cancelada pelo escalador.</Alert>
  }

  return (
    <div className="space-y-4">
      {erro && <Alert variant="error">{erro}</Alert>}

      {A_INICIAR.includes(viagem.status) && (
        <Cartao titulo="Iniciar viagem" icone={Play}>
          {atrasada && (
            <Alert variant="warning">
              Saída prevista às {formatarHoraLocal(viagem.inicioPrevisto)} — você está {Math.floor(minutosAtraso / 60) > 0 ? `${Math.floor(minutosAtraso / 60)}h${String(minutosAtraso % 60).padStart(2, "0")}` : `${minutosAtraso} min`} atrasado. Informe o motivo.
            </Alert>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            Km inicial (hodômetro)
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex: 152300"
              value={kmInicial}
              onChange={(e) => setKmInicial(soNumeros(e.target.value))}
              className="h-12 text-lg tabular-nums"
            />
          </label>
          {atrasada && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Motivo do atraso</legend>
              <div className="grid grid-cols-2 gap-2">
                {[...MOTIVOS_ATRASO, MOTIVO_OUTRO].map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={motivo === opcao}
                    onClick={() => setMotivo(opcao)}
                    className={cn(
                      "min-h-11 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                      motivo === opcao ? "border-primary bg-primary/10 font-medium text-primary" : "bg-background hover:bg-muted",
                    )}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
              {motivo === MOTIVO_OUTRO && (
                <Input
                  placeholder="Escreva o motivo"
                  maxLength={TAMANHO_MAXIMO_MOTIVO}
                  value={motivoOutro}
                  onChange={(e) => setMotivoOutro(e.target.value)}
                  className="h-11"
                />
              )}
            </fieldset>
          )}
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base"
            disabled={pendente || !kmInicial || (atrasada && !motivoFinal)}
            onClick={() =>
              executar(() => iniciarViagem(viagem.id, { kmInicial: Number(kmInicial), motivoAtraso: atrasada ? motivoFinal : null }))
            }
          >
            {pendente ? "Iniciando..." : "Iniciar viagem agora"}
          </Button>
        </Cartao>
      )}

      {EM_ANDAMENTO.includes(viagem.status) && (
        <>
          <Alert variant="success">
            Viagem iniciada às {viagem.horarioRealSaida ? formatarHoraLocal(viagem.horarioRealSaida) : "—"}
            {viagem.kmInicial !== null && ` · km inicial ${viagem.kmInicial}`}
            {viagem.motivoAtraso && ` · atraso: ${viagem.motivoAtraso}`}
          </Alert>

          <Cartao titulo="Pedágio e pernoite" icone={Ticket}>
            <div className="inline-flex w-full rounded-lg border bg-muted/40 p-1" role="group" aria-label="Tipo de despesa">
              {(["PEDAGIO", "PERNOITE"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  aria-pressed={tipoDespesa === tipo}
                  onClick={() => setTipoDespesa(tipo)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm transition-colors",
                    tipoDespesa === tipo ? "bg-background font-medium shadow-sm ring-1 ring-border" : "text-muted-foreground",
                  )}
                >
                  {ROTULO_DESPESA[tipo]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="Valor (R$)"
                aria-label="Valor em reais"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-12 text-lg tabular-nums"
              />
              <Button
                type="button"
                className="h-12 px-5"
                disabled={pendente || parseReaisParaCentavos(valor) === null}
                onClick={() => {
                  const centavos = parseReaisParaCentavos(valor)
                  if (centavos === null) return
                  executar(() => lancarDespesa(viagem.id, { tipo: tipoDespesa, valorCentavos: centavos }), () => setValor(""))
                }}
              >
                Lançar
              </Button>
            </div>
            {viagem.despesas.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {viagem.despesas.map((despesa) => (
                  <li key={despesa.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      {despesa.tipo === "PEDAGIO" ? <Ticket className="size-4 text-muted-foreground" aria-hidden /> : <BedDouble className="size-4 text-muted-foreground" aria-hidden />}
                      {ROTULO_DESPESA[despesa.tipo]}
                      <span className="text-xs text-muted-foreground">{formatarHoraLocal(despesa.registradoEm)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium tabular-nums">{formatarReais(despesa.valorCentavos)}</span>
                      {despesa.minha && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Apagar ${ROTULO_DESPESA[despesa.tipo]} de ${formatarReais(despesa.valorCentavos)}`}
                          disabled={pendente}
                          onClick={() => executar(() => removerDespesa(viagem.id, despesa.id))}
                        >
                          <Trash2 className="size-4 text-muted-foreground" aria-hidden />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Totais despesas={viagem.despesas} />
          </Cartao>

          <Cartao titulo="Encerrar viagem" icone={Flag}>
            <label className="grid gap-1.5 text-sm font-medium">
              Km final (hodômetro)
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder={viagem.kmInicial !== null ? `Maior que ${viagem.kmInicial}` : "Ex: 152780"}
                value={kmFinal}
                onChange={(e) => setKmFinal(soNumeros(e.target.value))}
                className="h-12 text-lg tabular-nums"
              />
            </label>
            {viagem.kmInicial !== null && kmFinal && Number(kmFinal) >= viagem.kmInicial && (
              <p className="text-sm text-muted-foreground">Rodou {Number(kmFinal) - viagem.kmInicial} km.</p>
            )}
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 w-full text-base"
              disabled={pendente || !kmFinal}
              onClick={() => setConfirmarEncerrar(true)}
            >
              Encerrar viagem
            </Button>
          </Cartao>

          <ConfirmDialog
            open={confirmarEncerrar}
            onOpenChange={setConfirmarEncerrar}
            title={`Encerrar a viagem ${viagem.numViagem}?`}
            description={`Km final ${kmFinal}. Depois de encerrar não dá pra lançar mais pedágio ou pernoite.`}
            confirmLabel="Encerrar"
            confirmingLabel="Encerrando..."
            destructive={false}
            confirming={pendente}
            erro={erro || null}
            onConfirm={() => executar(() => encerrarViagem(viagem.id, { kmFinal: Number(kmFinal) }), () => setConfirmarEncerrar(false))}
          />
        </>
      )}

      {viagem.status === "FINALIZADA" && (
        <Cartao titulo="Viagem encerrada" icone={CircleCheck}>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Km inicial</dt>
              <dd className="font-semibold tabular-nums">{viagem.kmInicial ?? "—"}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Km final</dt>
              <dd className="font-semibold tabular-nums">{viagem.kmFinal ?? "—"}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Rodou</dt>
              <dd className="font-semibold tabular-nums">
                {viagem.kmInicial !== null && viagem.kmFinal !== null ? `${viagem.kmFinal - viagem.kmInicial} km` : "—"}
              </dd>
            </div>
          </dl>
          <Totais despesas={viagem.despesas} />
        </Cartao>
      )}
    </div>
  )
}
