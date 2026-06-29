import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Truck } from "lucide-react"
import { buscarViagens } from "@/lib/queries/viagens"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function ViagensPage() {
  const viagens = await buscarViagens()

  const formatarData = (data: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Viagens</h1>
          <p className="text-slate-500 mt-1">Acompanhe e aloque motoristas para as suas cargas.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/viagens/alocacao">
            <Button variant="outline">
              Alocação Manual
            </Button>
          </Link>
          <Link href="/viagens/nova">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <PlusCircle className="w-5 h-5 mr-2" />
              Nova Viagem
            </Button>
          </Link>
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">Nº Viagem</TableHead>
              <TableHead className="font-semibold text-slate-700">Início Previsto</TableHead>
              <TableHead className="font-semibold text-slate-700">Turno</TableHead>
              <TableHead className="font-semibold text-slate-700">Caminhão</TableHead>
              <TableHead className="font-semibold text-slate-700">Motorista</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {viagens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <Truck className="w-8 h-8 text-slate-300 mb-2" />
                    <p>Nenhuma viagem cadastrada ainda.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              viagens.map((viagem) => (
                <TableRow key={viagem.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{viagem.numViagem}</TableCell>
                  <TableCell>{formatarData(viagem.inicioPrevisto)}</TableCell>
                  <TableCell>
                    <Badge variant={viagem.turno === "MANHA" ? "default" : "secondary"}>
                      {viagem.turno}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium text-slate-900">{viagem.cavalo}</span>
                      <span className="text-slate-500 ml-1">/ {viagem.carreta}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {viagem.motorista ? (
                      <span className="text-slate-900 font-medium">{viagem.motorista.nome}</span>
                    ) : (
                      <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600">
                        Pendente Alocação
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/viagens/editar/${viagem.id}`}>
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}