"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Popover } from "radix-ui"
import { CheckCircle2, Pencil, Play, RotateCcw, Trash2 } from "lucide-react"
import { AcoesLinha, BotaoIcone } from "@/components/ui/botao-icone"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { concluirManutencao, excluirManutencao, iniciarManutencao, reabrirManutencao } from "@/lib/actions/manutencoes"
import { formatDateTimeForInput } from "@/lib/utils/date-format"
import type { SituacaoManutencao } from "@/lib/services/manutencao-regras"

type Props = {
  id: number
  descricaoCurta: string
  situacao: SituacaoManutencao
  /** Sugestão de horário pro "Concluir": o fim previsto, se já passou; senão agora. */
  sugestaoFim: string | null
}

/** Botão que abre um painel com o horário (padrão: agora) antes de registrar início ou fim. */
function RegistrarHorario({
  rotulo,
  icone,
  sugestao,
  onConfirmar,
}: {
  rotulo: string
  icone: typeof Play
  sugestao: string | null
  onConfirmar: (horario: string) => Promise<string | null>
}) {
  const [aberto, setAberto] = useState(false)
  const [horario, setHorario] = useState("")
  const [erro, setErro] = useState("")
  const [pendente, iniciar] = useTransition()
  const Icone = icone

  return (
    <Popover.Root
      open={aberto}
      onOpenChange={(proximo) => {
        if (proximo) {
          setHorario(sugestao ?? formatDateTimeForInput(new Date()))
          setErro("")
        }
        setAberto(proximo)
      }}
    >
      <Popover.Trigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title={rotulo} aria-label={rotulo} className="text-muted-foreground hover:text-foreground">
          <Icone aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-72 space-y-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
          <p className="text-sm font-medium">{rotulo}</p>
          <div className="flex gap-2">
            <Input type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} className="h-8 text-xs" disabled={pendente} />
            <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => setHorario(formatDateTimeForInput(new Date()))}>
              Agora
            </Button>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={pendente || !horario}
            onClick={() =>
              iniciar(async () => {
                const falha = await onConfirmar(horario)
                if (falha) setErro(falha)
                else setAberto(false)
              })
            }
          >
            {pendente ? "Salvando..." : "Confirmar"}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default function AcoesManutencao({ id, descricaoCurta, situacao, sugestaoFim }: Props) {
  const router = useRouter()
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const executar = async (acao: () => Promise<{ sucesso: true } | { sucesso: false; erro: string }>) => {
    const resposta = await acao()
    if (!resposta.sucesso) return resposta.erro
    router.refresh()
    return null
  }

  return (
    <AcoesLinha>
      {situacao === "AGENDADA" && (
        <RegistrarHorario rotulo="Registrar início" icone={Play} sugestao={null} onConfirmar={(h) => executar(() => iniciarManutencao(id, h))} />
      )}
      {situacao !== "CONCLUIDA" && (
        <RegistrarHorario rotulo="Concluir (veículo liberado)" icone={CheckCircle2} sugestao={sugestaoFim} onConfirmar={(h) => executar(() => concluirManutencao(id, h))} />
      )}
      {situacao === "CONCLUIDA" && (
        <BotaoIcone
          rotulo="Reabrir (concluiu por engano)"
          icone={RotateCcw}
          disabled={pendente}
          onClick={() => iniciar(async () => void (await executar(() => reabrirManutencao(id))))}
        />
      )}
      <BotaoIcone href={`/frotas/manutencoes/editar/${id}`} rotulo="Editar manutenção" icone={Pencil} />
      <BotaoIcone rotulo="Excluir manutenção" icone={Trash2} perigo onClick={() => { setErroExcluir(null); setExcluindo(true) }} />
      <ConfirmDialog
        open={excluindo}
        onOpenChange={setExcluindo}
        title="Excluir manutenção"
        description={`Excluir "${descricaoCurta}"? Ela some da agenda e do relatório de disponibilidade.`}
        confirming={pendente}
        erro={erroExcluir}
        onConfirm={() =>
          iniciar(async () => {
            const falha = await executar(() => excluirManutencao(id))
            if (falha) setErroExcluir(falha)
            else setExcluindo(false)
          })
        }
      />
    </AcoesLinha>
  )
}
