"use client"

import { useMemo, useState, useTransition } from "react"
import type { MotoristaCompativel, MotoristaSugerido } from "@/lib/types/alocacao"
import type { NovaViagemFormValues } from "@/lib/validation/viagens"
import type { ResultadoImportacaoLote } from "@/lib/types/types"
import { criarViagensEmLoteComAlocacao } from "@/lib/actions/viagens"
import { periodosConflitamComDescanso } from "@/lib/services/alocacao.service"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { classeBadgeTurno } from "@/app/viagens/badge-styles"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, CheckCircle2, UserCheck } from "lucide-react"

export type ViagemParaConfirmar = {
  dados: NovaViagemFormValues
  motoristaSugerido: MotoristaSugerido
  motoristasCompativeis: MotoristaCompativel[]
}

type Props = {
  viagens: ViagemParaConfirmar[]
  onConcluido: (resultado: ResultadoImportacaoLote) => void
  onCancelar: () => void
}

export default function ConfirmarLoteViagens({ viagens, onConcluido, onCancelar }: Props) {
  const [isPending, startTransition] = useTransition()
  const [selecoes, setSelecoes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      viagens.map((viagem) => [
        viagem.dados.numViagem,
        viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : "",
      ]),
    ),
  )
  const [erro, setErro] = useState("")

  // Motorista selecionado por viagem (explícito ou, na falta, a sugestão automática),
  // usado só para detectar conflitos de agenda dentro do próprio lote em revisão.
  const selecaoEfetivaPorViagem = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const viagem of viagens) {
      const sugestao = viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : ""
      mapa[viagem.dados.numViagem] = selecoes[viagem.dados.numViagem] || sugestao
    }
    return mapa
  }, [viagens, selecoes])

  // Viagens que têm o mesmo motorista selecionado sem 1 dia de descanso entre elas.
  // Só avisa — não troca nada automaticamente, quem decide é o usuário.
  const conflitosPorViagem = useMemo(() => {
    const mapa: Record<string, string[]> = {}

    for (const viagemA of viagens) {
      const motoristaA = selecaoEfetivaPorViagem[viagemA.dados.numViagem]
      if (!motoristaA) continue

      const numerosConflitantes = viagens
        .filter((viagemB) => {
          if (viagemB.dados.numViagem === viagemA.dados.numViagem) return false
          if (selecaoEfetivaPorViagem[viagemB.dados.numViagem] !== motoristaA) return false

          return periodosConflitamComDescanso(
            new Date(viagemA.dados.inicioPrevisto),
            new Date(viagemA.dados.fimPrevisto),
            new Date(viagemB.dados.inicioPrevisto),
            new Date(viagemB.dados.fimPrevisto),
          )
        })
        .map((viagemB) => viagemB.dados.numViagem)

      if (numerosConflitantes.length > 0) {
        mapa[viagemA.dados.numViagem] = numerosConflitantes
      }
    }

    return mapa
  }, [viagens, selecaoEfetivaPorViagem])

  const atualizarSelecao = (numViagem: string, motoristaId: string) => {
    setSelecoes((atual) => ({ ...atual, [numViagem]: motoristaId }))
  }

  const confirmarCriacao = () => {
    setErro("")

    const payload = viagens.map((viagem) => {
      const selecionado = selecoes[viagem.dados.numViagem]
      return {
        dados: viagem.dados,
        motoristaId: selecionado ? Number(selecionado) : null,
      }
    })

    startTransition(async () => {
      try {
        const resultado = await criarViagensEmLoteComAlocacao(payload)
        onConcluido(resultado)
      } catch {
        setErro("Ocorreu um erro inesperado ao criar as viagens.")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-slate-600" />
          <span className="font-medium text-slate-900">
            Revise a alocação sugerida para {viagens.length} viagem(ns) antes de criar
          </span>
        </div>
        <Badge variant="outline">{isPending ? "Criando..." : "Aguardando confirmação"}</Badge>
      </div>

      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>
      )}

      <div className="grid gap-4">
        {viagens.map((viagem) => {
          const numViagem = viagem.dados.numViagem
          const sugestao = viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : ""
          const motoristaSelecionado = selecoes[numViagem] || sugestao
          const semCompatibilidade = viagem.motoristasCompativeis.length === 0

          return (
            <Card key={numViagem} className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b bg-white sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <CardTitle className="text-lg text-slate-900">Viagem {numViagem}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {viagem.dados.cavalo} / {viagem.dados.carreta} · {formatarDataHoraPtBr(viagem.dados.inicioPrevisto)}
                  </p>
                </div>
                <Badge variant="outline" className={classeBadgeTurno(viagem.dados.turno)}>
                  {viagem.dados.turno}
                </Badge>
              </CardHeader>

              <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <UserCheck className="h-4 w-4" />
                    <span>Motoristas compatíveis: {viagem.motoristasCompativeis.length}</span>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    {semCompatibilidade ? (
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        Nenhum motorista compatível — a viagem é criada sem motorista, aloque depois manualmente.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Sugestão automática
                        </p>
                        <p className="text-sm font-medium text-slate-900">{viagem.motoristaSugerido?.nome}</p>
                        <p className="text-xs text-slate-500">
                          Priorizado pelo maior número de dias disponíveis na jornada.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">Motorista</p>
                    <Select value={motoristaSelecionado} onValueChange={(value) => atualizarSelecao(numViagem, value)}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione um motorista (ou deixe sem alocar)" />
                      </SelectTrigger>
                      <SelectContent>
                        {viagem.motoristasCompativeis.length === 0 ? (
                          <SelectItem value="0" disabled>
                            Sem motorista compatível
                          </SelectItem>
                        ) : (
                          viagem.motoristasCompativeis.map((motorista) => (
                            <SelectItem key={motorista.id} value={String(motorista.id)}>
                              {motorista.nome} · {motorista.diasDisponiveis} dia(s) disponível(is)
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {conflitosPorViagem[numViagem] && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Esse motorista também está selecionado na(s) viagem(ns) {conflitosPorViagem[numViagem].join(", ")},
                        sem 1 dia de descanso entre elas.
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t bg-slate-50 text-xs text-slate-500">
                <span>Entrega(s): {viagem.dados.entregas.length}</span>
                <span>Fim previsto: {formatarDataHoraPtBr(viagem.dados.fimPrevisto)}</span>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="button" className="bg-blue-600 hover:bg-blue-700" disabled={isPending} onClick={confirmarCriacao}>
          {isPending ? (
            "Criando viagens..."
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar e Criar {viagens.length} Viagem(ns)
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
