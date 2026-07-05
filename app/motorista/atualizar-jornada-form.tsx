"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { atualizarJornadaMotoristaNoCalendario } from "@/lib/actions/motoristas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type MotoristaOpcao = {
  id: number
  nome: string
}

type DiaOpcao = {
  valor: string
  label: string
}

type Props = {
  motoristas: MotoristaOpcao[]
  dias: DiaOpcao[]
  selecaoInicial?: {
    motoristaId?: number
    dia?: string
    codigoNoDia?: number
  }
  mes?: string
}

export default function AtualizarJornadaForm({ motoristas, dias, selecaoInicial, mes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const motoristaInicialValido =
    selecaoInicial?.motoristaId && motoristas.some((motorista) => motorista.id === selecaoInicial.motoristaId)
      ? String(selecaoInicial.motoristaId)
      : motoristas[0]
      ? String(motoristas[0].id)
      : ""
  const diaInicialValido =
    selecaoInicial?.dia && dias.some((dia) => dia.valor === selecaoInicial.dia)
      ? selecaoInicial.dia
      : dias[0]?.valor ?? ""
  const codigoInicialValido =
    selecaoInicial?.codigoNoDia && selecaoInicial.codigoNoDia >= 1 && selecaoInicial.codigoNoDia <= 10
      ? String(selecaoInicial.codigoNoDia)
      : "1"
  const [motoristaId, setMotoristaId] = useState<string>(motoristaInicialValido)
  const [diaSelecionado, setDiaSelecionado] = useState<string>(diaInicialValido)
  const [codigoNoDia, setCodigoNoDia] = useState<string>(codigoInicialValido)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")

  const codigos = useMemo(
    () => [
      { valor: "1", label: "1º dia" },
      { valor: "2", label: "2º dia" },
      { valor: "3", label: "3º dia" },
      { valor: "4", label: "4º dia" },
      { valor: "5", label: "5º dia" },
      { valor: "6", label: "6º dia" },
      { valor: "7", label: "Folga" },
      { valor: "8", label: "Férias" },
      { valor: "9", label: "Exames" },
      { valor: "10", label: "Interno" },
    ],
    []
  )

  const salvar = () => {
    if (!motoristaId || !diaSelecionado || !codigoNoDia) {
      setErro("Selecione motorista, dia e código da jornada.")
      return
    }

    setErro("")
    setSucesso("")

    startTransition(async () => {
      const resposta = await atualizarJornadaMotoristaNoCalendario(
        Number(motoristaId),
        diaSelecionado,
        Number(codigoNoDia)
      )

      if (!resposta.sucesso) {
        setErro(resposta.erro ?? "Não foi possível atualizar a jornada.")
        return
      }

      setSucesso("Jornada atualizada com sucesso.")
      router.replace(mes ? `/motorista?mes=${mes}` : "/motorista")
      router.refresh()
    })
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50">
        <CardTitle className="text-base">Atualizar dia do motorista</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={motoristaId} onValueChange={setMotoristaId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Motorista" />
            </SelectTrigger>
            <SelectContent>
              {motoristas.map((motorista) => (
                <SelectItem key={motorista.id} value={String(motorista.id)}>
                  {motorista.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={diaSelecionado} onValueChange={setDiaSelecionado}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Dia" />
            </SelectTrigger>
            <SelectContent>
              {dias.map((dia) => (
                <SelectItem key={dia.valor} value={dia.valor}>
                  {dia.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={codigoNoDia} onValueChange={setCodigoNoDia}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Código" />
            </SelectTrigger>
            <SelectContent>
              {codigos.map((codigo) => (
                <SelectItem key={codigo.valor} value={codigo.valor}>
                  {codigo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" onClick={salvar} disabled={isPending || motoristas.length === 0}>
            {isPending ? "Salvando..." : "Aplicar no calendário"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Dica: clique no status de qualquer célula do calendário para preencher automaticamente os campos.
        </p>

        {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}
        {sucesso ? <p className="mt-2 text-sm text-emerald-700">{sucesso}</p> : null}
      </CardContent>
    </Card>
  )
}
