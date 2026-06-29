"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { EditarViagemInput } from "@/lib/types/types"
import type { ViagemAlocacao } from "@/lib/types/alocacao"
import { editarViagem } from "@/lib/actions/viagens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, CheckCircle2, PencilLine, Route, Save, UserCheck } from "lucide-react"

type Props = {
  viagens: ViagemAlocacao[]
}

function formatarData(dataISO: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dataISO))
}

export default function AlocacaoViagensClient({ viagens }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selecoes, setSelecoes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      viagens.map((viagem) => [viagem.id, viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : ""])
    )
  )
  const [salvandoId, setSalvandoId] = useState<number | null>(null)
  const [mensagem, setMensagem] = useState<string>("")
  const [erro, setErro] = useState<string>("")

  const totalPendentes = useMemo(() => viagens.length, [viagens.length])

  const atualizarSelecao = (viagemId: number, motoristaId: string) => {
    setSelecoes((atual) => ({
      ...atual,
      [viagemId]: motoristaId,
    }))
  }

  const salvarAlocacao = (viagem: ViagemAlocacao) => {
    const motoristaSelecionado = selecoes[viagem.id]

    if (!motoristaSelecionado) {
      setErro("Selecione um motorista antes de salvar a alocação.")
      return
    }

    setErro("")
    setMensagem("")
    setSalvandoId(viagem.id)

    const payload: EditarViagemInput = {
      numViagem: viagem.numViagem,
      carreta: viagem.carreta,
      cavalo: viagem.cavalo,
      tanque: viagem.tanque,
      diasViagem: viagem.diasViagem,
      inicioPrevisto: viagem.inicioPrevisto,
      fimPrevisto: viagem.fimPrevisto,
      turno: viagem.turno,
      motoristaId: Number(motoristaSelecionado),
      entregas: viagem.entregas.map((entrega) => ({
        id: entrega.id,
        dataEntrega: entrega.dataEntrega,
        cliente: entrega.cliente,
        cidade: entrega.cidade,
        uf: entrega.uf,
        kg: entrega.kg,
        m3: entrega.m3,
        obs: entrega.obs,
        sapcode: entrega.sapcode,
        codewhite: entrega.codewhite,
      })),
    }

    startTransition(async () => {
      try {
        const resposta = await editarViagem(viagem.id, payload)

        if (!resposta.sucesso) {
          setErro(resposta.erro ?? "Não foi possível salvar a alocação.")
          return
        }

        setMensagem(`Viagem ${viagem.numViagem} alocada com sucesso.`)
        router.refresh()
      } catch {
        setErro("Ocorreu um erro inesperado ao salvar a alocação.")
      } finally {
        setSalvandoId(null)
      }
    })
  }

  if (totalPendentes === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <div>
          <p className="text-base font-semibold text-slate-900">Nenhuma viagem pendente.</p>
          <p className="mt-1 text-sm text-slate-500">Todas as viagens disponíveis já possuem motorista alocado.</p>
        </div>
        <Link href="/viagens">
          <Button variant="outline">Ver viagens</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-slate-600" />
          <span className="font-medium text-slate-900">{totalPendentes} viagem(ns) pendente(s)</span>
        </div>
        <Badge variant="outline">{isPending ? "Salvando..." : "Pronto para alocar"}</Badge>
      </div>

      {mensagem && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {mensagem}
        </div>
      )}

      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="grid gap-4">
        {viagens.map((viagem) => {
          const sugestao = viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : ""
          const motoristaSelecionado = selecoes[viagem.id] || sugestao
          const semCompatibilidade = viagem.motoristasCompativeis.length === 0

          return (
            <Card key={viagem.id} className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-white">
                <div>
                  <CardTitle className="text-lg text-slate-900">Viagem {viagem.numViagem}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {viagem.cavalo} / {viagem.carreta} · {formatarData(viagem.inicioPrevisto)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline">{viagem.turno}</Badge>
                  {viagem.integracaoExigida ? (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      Integração: {viagem.integracaoExigida}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Sem integração</Badge>
                  )}
                </div>
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
                        Nenhum motorista compatível encontrado. Use a edição manual.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Sugestão automática
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {viagem.motoristaSugerido?.nome}
                        </p>
                        <p className="text-xs text-slate-500">
                          Ordenado por menor quantidade de dias trabalhados.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Compatíveis disponíveis
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {viagem.motoristasCompativeis.length === 0 ? (
                        <span className="text-sm text-slate-500">Sem opções no momento</span>
                      ) : (
                        viagem.motoristasCompativeis.map((motorista) => (
                          <Badge key={motorista.id} variant="secondary">
                            {motorista.nome} · {motorista.diasTrabalhados} dia(s)
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">Escolher motorista</p>
                    <Select
                      value={motoristaSelecionado}
                      onValueChange={(value) => atualizarSelecao(viagem.id, value)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione um motorista" />
                      </SelectTrigger>
                      <SelectContent>
                        {viagem.motoristasCompativeis.length === 0 ? (
                          <SelectItem value="0" disabled>
                            Sem motorista compatível
                          </SelectItem>
                        ) : (
                          viagem.motoristasCompativeis.map((motorista) => (
                            <SelectItem key={motorista.id} value={String(motorista.id)}>
                              {motorista.nome}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={semCompatibilidade || salvandoId === viagem.id}
                      onClick={() => salvarAlocacao(viagem)}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {salvandoId === viagem.id ? "Salvando..." : "Alocar"}
                    </Button>

                    <Link href={`/viagens/editar/${viagem.id}`}>
                      <Button type="button" variant="outline" className="flex-1">
                        <PencilLine className="mr-2 h-4 w-4" />
                        Manual
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t bg-slate-50 text-xs text-slate-500">
                <span>Entrega(s): {viagem.entregas.length}</span>
                <span>Fim previsto: {formatarData(viagem.fimPrevisto)}</span>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
