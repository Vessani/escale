"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { EditarViagemInput } from "@/lib/types/types"
import type { MotoristaCompativel, ViagemAlocacao } from "@/lib/types/alocacao"
import { editarViagem } from "@/lib/actions/viagens"
import { useConflitosAlocacao } from "@/lib/hooks/use-conflitos-alocacao"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { classeBadgeTurno } from "../badge-styles"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { formatarProduto } from "@/lib/services/produto.service"
import { formatarDetalheMotoristaCompativel, formatarOpcaoMotoristaCompativel } from "@/lib/utils/motorista-format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, PencilLine, Route, Save, UserCheck } from "lucide-react"

const LIMITE_MOTORISTAS_VISIVEIS = 5

/** Lista de motoristas compatíveis com hierarquia visual (avatar + nome + metadados) em vez de uma parede de badges. */
function MotoristasCompativeisLista({ motoristas }: { motoristas: MotoristaCompativel[] }) {
  const [expandido, setExpandido] = useState(false)

  if (motoristas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem opções no momento</p>
  }

  const visiveis = expandido ? motoristas : motoristas.slice(0, LIMITE_MOTORISTAS_VISIVEIS)
  const ocultos = motoristas.length - visiveis.length

  return (
    <div className="space-y-1">
      {visiveis.map((motorista) => (
        <div key={motorista.id} className="flex items-center gap-2 py-0.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {motorista.nome.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{motorista.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {motorista.diasDisponiveis} dia(s) disponível(is)
              {motorista.horarioHabitual ? ` · jornada às ${motorista.horarioHabitual}` : ""}
              {motorista.proximoInicioDisponivel ? ` · disponível a partir de ${motorista.proximoInicioDisponivel}` : ""}
            </p>
          </div>
        </div>
      ))}
      {ocultos > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="pl-8 text-xs font-medium text-primary hover:underline"
        >
          + {ocultos} outro(s)
        </button>
      )}
      {expandido && motoristas.length > LIMITE_MOTORISTAS_VISIVEIS && (
        <button
          type="button"
          onClick={() => setExpandido(false)}
          className="pl-8 text-xs font-medium text-muted-foreground hover:underline"
        >
          Mostrar menos
        </button>
      )}
    </div>
  )
}

type Props = {
  viagens: ViagemAlocacao[]
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

  const itensParaConflito = useMemo(
    () =>
      viagens.map((viagem) => ({
        chave: String(viagem.id),
        numViagem: viagem.numViagem,
        motoristaSugeridoId: viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : "",
        inicioPrevisto: viagem.inicioPrevisto,
        fimPrevisto: viagem.fimPrevisto,
      })),
    [viagens],
  )
  const selecoesPorChave = useMemo(
    () => Object.fromEntries(Object.entries(selecoes).map(([id, motoristaId]) => [String(id), motoristaId])),
    [selecoes],
  )
  const { conflitosPorViagem } = useConflitosAlocacao(itensParaConflito, selecoesPorChave)

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

    // Produto passou a ser obrigatório pra salvar qualquer viagem — essa tela
    // não tem seletor de produto (só realoca motorista), então uma viagem
    // antiga sem produto definido precisa passar pela edição manual primeiro.
    if (!viagem.produto) {
      setErro('Essa viagem ainda não tem produto definido. Use "Manual" para editá-la e escolher o produto antes de alocar.')
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
      produto: viagem.produto,
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
      <EmptyState
        icone={CheckCircle2}
        classeIcone="text-success"
        titulo="Nenhuma viagem pendente"
        descricao="Todas as viagens disponíveis já possuem motorista alocado."
        acao={
          <Link href="/viagens">
            <Button variant="outline">Ver viagens</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-4">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-foreground/80" />
          <span className="font-medium text-foreground">{totalPendentes} viagem(ns) pendente(s)</span>
        </div>
        <Badge variant="outline">{isPending ? "Salvando..." : "Pronto para alocar"}</Badge>
      </div>

      {mensagem && <Alert variant="success">{mensagem}</Alert>}

      {erro && <Alert variant="error">{erro}</Alert>}

      <div className="grid gap-4">
        {viagens.map((viagem) => {
          const sugestao = viagem.motoristaSugerido ? String(viagem.motoristaSugerido.id) : ""
          const motoristaSelecionado = selecoes[viagem.id] || sugestao
          const semCompatibilidade = viagem.motoristasCompativeis.length === 0
          // Fechado, o campo mostra dias disponíveis + horário livre, sem repetir
          // o nome (esse já tá na carta de sugestão ao lado).
          const motoristaAtual = viagem.motoristasCompativeis.find((m) => String(m.id) === motoristaSelecionado)

          return (
            <Card key={viagem.id} className="border-border shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b bg-card sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <CardTitle className="text-lg text-foreground">Viagem <span className="font-mono tabular-nums">{viagem.numViagem}</span></CardTitle>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    <span className="font-mono">{viagem.cavalo} / {viagem.carreta}</span> · <span className="font-mono">{formatarDataHoraPtBr(viagem.inicioPrevisto)}</span>
                  </p>
                  {viagem.avisoFrotaIndisponivel && (
                    <Alert variant="warning" inline className="mt-1" title={viagem.avisoFrotaIndisponivel}>
                      Frota indisponível no horário
                    </Alert>
                  )}
                  {viagem.avisoFrotaProdutoIncompativel && (
                    <Alert variant="warning" inline className="mt-1" title={viagem.avisoFrotaProdutoIncompativel}>
                      Frota de outro produto
                    </Alert>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline" className={classeBadgeTurno(viagem.turno)}>
                    {viagem.turno}
                  </Badge>
                  {viagem.produto ? (
                    <Badge variant="outline">Produto: {formatarProduto(viagem.produto)}</Badge>
                  ) : (
                    <Badge variant="warning">Produto não definido</Badge>
                  )}
                  {viagem.integracaoExigida ? (
                    <Badge variant="warning">
                      Integração: {viagem.integracaoExigida}
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      Sem integração
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-foreground/80">
                    <UserCheck className="h-4 w-4" />
                    <span>Motoristas compatíveis: {viagem.motoristasCompativeis.length}</span>
                  </div>

                  <div className="rounded-md border border-border bg-muted p-3">
                    {semCompatibilidade ? (
                      <Alert variant="warning">
                        Nenhum motorista compatível encontrado. Use a edição manual.
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Sugestão automática
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {viagem.motoristaSugerido?.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Priorizado por quem libera mais perto do horário ideal, respeitando o descanso legal (dias disponíveis desempata).
                        </p>
                      </div>
                    )}
                  </div>

                  {viagem.avisoInterjornada && <Alert variant="warning">{viagem.avisoInterjornada}</Alert>}

                  <div className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Compatíveis disponíveis
                    </p>
                    <MotoristasCompativeisLista motoristas={viagem.motoristasCompativeis} />
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-border bg-muted p-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Escolher motorista</p>
                    <Select
                      value={motoristaSelecionado}
                      onValueChange={(value) => atualizarSelecao(viagem.id, value)}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Selecione um motorista">
                          {motoristaAtual && formatarDetalheMotoristaCompativel(motoristaAtual)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {viagem.motoristasCompativeis.length === 0 ? (
                          <SelectItem value="0" disabled>
                            Sem motorista compatível
                          </SelectItem>
                        ) : (
                          viagem.motoristasCompativeis.map((motorista) => (
                            <SelectItem key={motorista.id} value={String(motorista.id)}>
                              {formatarOpcaoMotoristaCompativel(motorista)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {conflitosPorViagem[String(viagem.id)] && (
                    <Alert variant="warning">
                      Esse motorista também está selecionado na(s) viagem(ns){" "}
                      {conflitosPorViagem[String(viagem.id)].join(", ")}, sem 11h de descanso entre elas.
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
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
              <CardFooter className="flex items-center justify-between border-t bg-muted text-xs text-muted-foreground">
                <span className="tabular-nums">Entrega(s): {viagem.entregas.length}</span>
                <span className="tabular-nums">Fim previsto: <span className="font-mono">{formatarDataHoraPtBr(viagem.fimPrevisto)}</span></span>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
