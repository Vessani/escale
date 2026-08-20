"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUS_VIAGEM_OPCOES } from "@/lib/services/viagem-status.service"

type MotoristaParaSelect = { id: number; nome: string }

function hojeParaInput() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, "0")
  const dia = String(agora.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function RelatorioGeralCard() {
  const [status, setStatus] = useState("TODOS")
  const [de, setDe] = useState("")
  const [ate, setAte] = useState("")

  const params = new URLSearchParams()
  if (status !== "TODOS") params.set("status", status)
  if (de) params.set("de", de)
  if (ate) params.set("ate", ate)
  const href = `/api/relatorios/geral${params.toString() ? `?${params.toString()}` : ""}`

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg">Relatório Geral</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-slate-500">
          Todas as viagens (qualquer status), com motorista e frota cruzados nas colunas.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                {STATUS_VIAGEM_OPCOES.map((opcao) => (
                  <SelectItem key={opcao.valor} value={opcao.valor}>{opcao.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">De</label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Até</label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
        <a href={href}>
          <Button type="button">
            <Download className="w-4 h-4 mr-2" />
            Baixar Excel
          </Button>
        </a>
      </CardContent>
    </Card>
  )
}

function RelatorioPorMotoristaCard({ motoristas }: { motoristas: MotoristaParaSelect[] }) {
  const [motoristaId, setMotoristaId] = useState("")
  const href = motoristaId ? `/api/relatorios/motorista/${motoristaId}` : ""

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg">Viagens do Motorista</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-slate-500">
          Viagens alocadas, iniciadas ou retornando de um motorista — pra enviar direto pra ele.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">Motorista</label>
          <Select value={motoristaId} onValueChange={setMotoristaId}>
            <SelectTrigger><SelectValue placeholder="Selecione o motorista" /></SelectTrigger>
            <SelectContent>
              {motoristas.map((motorista) => (
                <SelectItem key={motorista.id} value={String(motorista.id)}>{motorista.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <a href={href} aria-disabled={!motoristaId}>
          <Button type="button" disabled={!motoristaId}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Excel
          </Button>
        </a>
      </CardContent>
    </Card>
  )
}

function RelatorioDiarioCard() {
  const [data, setData] = useState(hojeParaInput())
  const href = `/api/relatorios/diario${data ? `?data=${data}` : ""}`

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg">Viagens Criadas no Dia</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-slate-500">
          Viagens criadas na data selecionada — pra enviar pra operação.
        </p>
        <div className="space-y-1.5 max-w-xs">
          <label className="text-xs font-medium text-slate-700">Data</label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <a href={href}>
          <Button type="button">
            <Download className="w-4 h-4 mr-2" />
            Baixar Excel
          </Button>
        </a>
      </CardContent>
    </Card>
  )
}

export default function RelatoriosClient({ motoristas }: { motoristas: MotoristaParaSelect[] }) {
  return (
    <div className="space-y-6">
      <RelatorioGeralCard />
      <RelatorioPorMotoristaCard motoristas={motoristas} />
      <RelatorioDiarioCard />
    </div>
  )
}
