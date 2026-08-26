"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Filter } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import type { IndicadoresDashboard } from "@/lib/queries/dashboard"
import type { StatusViagem } from "@prisma/client"

const CORES_STATUS: Record<StatusViagem, string> = {
  CRIADA: "#94a3b8",
  ALOCADA: "var(--info)",
  INICIADA: "#06b6d4",
  RETORNANDO: "#06b6d4",
  POSTERGADA: "var(--warning)",
  FINALIZADA: "var(--success)",
  CANCELADA: "var(--destructive)",
}

const CORES_PRODUTO = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#94a3b8"]

function formatarDiaCurto(dia: string) {
  const [, mes, dd] = dia.split("-")
  return `${dd}/${mes}`
}

function KpiCard({ label, valor, destaque }: { label: string; valor: string | number; destaque?: "success" | "destructive" | "warning" }) {
  const corTexto =
    destaque === "success" ? "text-success" : destaque === "destructive" ? "text-destructive" : destaque === "warning" ? "text-warning" : "text-slate-900"

  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${corTexto}`}>{valor}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardRelatorios({
  indicadores,
  de,
  ate,
}: {
  indicadores: IndicadoresDashboard
  de: string
  ate: string
}) {
  const { totalViagens, porStatus, porProduto, porDia, porTurno, comAviso, extras, topMotoristas, topClientesRotas, topClientesCancelamentos } = indicadores
  const viagensManha = porTurno.find((t) => t.turno === "MANHA")?.quantidade ?? 0
  const viagensNoite = porTurno.find((t) => t.turno === "NOITE")?.quantidade ?? 0
  const turnoComMais = viagensManha === viagensNoite ? "Empate" : viagensManha > viagensNoite ? "Manhã" : "Noite"

  const finalizadas = porStatus.find((s) => s.status === "FINALIZADA")?.quantidade ?? 0
  const canceladas = porStatus.find((s) => s.status === "CANCELADA")?.quantidade ?? 0
  const postergadas = porStatus.find((s) => s.status === "POSTERGADA")?.quantidade ?? 0
  const emAndamento = ["ALOCADA", "INICIADA", "RETORNANDO"].reduce(
    (soma, status) => soma + (porStatus.find((s) => s.status === status)?.quantidade ?? 0),
    0,
  )
  const taxaCancelamento = totalViagens > 0 ? ((canceladas / totalViagens) * 100).toFixed(1) : "0.0"

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-slate-200">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">De</label>
              <Input type="date" name="de" defaultValue={de} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Até</label>
              <Input type="date" name="ate" defaultValue={ate} className="w-40" />
            </div>
            <Button type="submit" variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar período
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total de viagens" valor={totalViagens} />
        <KpiCard label="Finalizadas" valor={finalizadas} destaque="success" />
        <KpiCard label="Em andamento" valor={emAndamento} />
        <KpiCard label="Postergadas" valor={postergadas} destaque="warning" />
        <KpiCard label="Canceladas" valor={canceladas} destaque="destructive" />
        <KpiCard label="Taxa de cancelamento" valor={`${taxaCancelamento}%`} destaque={Number(taxaCancelamento) > 15 ? "destructive" : undefined} />
        <KpiCard label="Extras (fora da programação)" valor={extras} destaque={extras > 0 ? "warning" : undefined} />
        <KpiCard label="Viagens de manhã" valor={viagensManha} />
        <KpiCard label="Viagens de noite" valor={viagensNoite} />
        <KpiCard label="Turno com mais viagens" valor={turnoComMais} />
      </div>

      {comAviso > 0 && (
        <p className="text-sm text-warning">
          {comAviso} viagem(ns) no período com algum aviso (interjornada, frota indisponível ou frota incompatível com o produto).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Viagens por dia</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {porDia.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma viagem no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={formatarDiaCurto} tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(v) => formatarDiaCurto(String(v))} />
                  <Bar dataKey="quantidade" name="Viagens" fill="var(--info)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Viagens por status</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
                <Tooltip />
                <Bar dataKey="quantidade" name="Viagens" radius={[0, 4, 4, 0]}>
                  {porStatus.map((entrada) => (
                    <Cell key={entrada.status} fill={CORES_STATUS[entrada.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Viagens por produto</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {porProduto.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma viagem no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={porProduto}
                    dataKey="quantidade"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(props: unknown) => {
                      const { label, quantidade } = props as { label: string; quantidade: number }
                      return `${label} (${quantidade})`
                    }}
                  >
                    {porProduto.map((entrada, indice) => (
                      <Cell key={entrada.label} fill={CORES_PRODUTO[indice % CORES_PRODUTO.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Motoristas com mais viagens</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {topMotoristas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma viagem alocada no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topMotoristas} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="quantidade" name="Viagens" fill="var(--info)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Clientes com mais rotas</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {topClientesRotas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma entrega no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topClientesRotas} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="quantidade" name="Viagens" fill="var(--success)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Clientes que mais cancelaram</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {topClientesCancelamentos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum cancelamento no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topClientesCancelamentos} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="quantidade" name="Cancelamentos" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
