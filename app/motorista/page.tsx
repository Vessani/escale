import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Users } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buscarMotoristas } from "@/lib/queries/motoristas" 

export default async function MotoristasPage() {
  const motoristas = await buscarMotoristas()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Motoristas</h1>
          <p className="text-slate-500 mt-1">Acompanhe a sua equipe, turnos e dias trabalhados.</p>
        </div>
        <Link href="/motorista/novo">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <PlusCircle className="w-5 h-5 mr-2" />
            Novo Motorista
          </Button>
        </Link>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">Nome do Motorista</TableHead>
              <TableHead className="font-semibold text-slate-700">SEVA</TableHead>
              <TableHead className="font-semibold text-slate-700">Turno</TableHead>
              <TableHead className="font-semibold text-slate-700 text-center">Dias Trabalhados</TableHead>
              <TableHead className="font-semibold text-slate-700">Integrações</TableHead>
              <TableHead className="font-semibold text-slate-700">Próxima Validade</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {motoristas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <Users className="w-8 h-8 text-slate-300 mb-2" />
                    <p>Nenhum motorista cadastrado ainda.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              motoristas.map((motorista) => (
                <TableRow key={motorista.id} className="hover:bg-slate-50">
                   
                  <TableCell className="font-medium text-slate-900">
                    {motorista.nome}
                  </TableCell>
                   
                  <TableCell className="text-slate-600 font-mono">
                    {motorista.seva}
                  </TableCell>
                   
                  <TableCell>
                    <Badge variant={motorista.turno === "MANHA" ? "default" : "secondary"}>
                      {motorista.turno}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-sm font-medium border border-slate-200">
                      {motorista.diasTrabalhados}
                    </span>
                  </TableCell>

                  <TableCell>
                    {motorista.integracao.length === 0 ? (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                        Sem integrações
                      </Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" className="block bg-blue-50 text-blue-700 border-blue-200">
                          {motorista.integracao.length} integração{motorista.integracao.length > 1 ? "ões" : ""}
                        </Badge>
                        <div className="text-xs text-slate-600">
                          {motorista.integracao.map((int) => (
                            <div key={int.id}>{int.cliente}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {motorista.integracao.length === 0 ? (
                      <span className="text-slate-400 text-sm">—</span>
                    ) : (
                      <div className="space-y-1">
                        {(() => {
                          const proximaValidade = motorista.integracao.reduce((menor, atual) => {
                            return atual.dataValidade < menor.dataValidade ? atual : menor;
                          });
                          const diasRestantes = Math.ceil(
                            (proximaValidade.dataValidade.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const vencida = proximaValidade.dataValidade < new Date();
                           
                          return (
                            <>
                              <div className={`text-sm font-medium ${vencida ? "text-red-600" : diasRestantes <= 7 ? "text-orange-600" : "text-green-600"}`}>
                                {new Intl.DateTimeFormat("pt-BR").format(proximaValidade.dataValidade)}
                              </div>
                              {vencida ? (
                                <Badge variant="destructive" className="text-xs">
                                  Vencida
                                </Badge>
                              ) : diasRestantes <= 7 ? (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                                  {diasRestantes} dias
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-500">{diasRestantes} dias</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Link href={`/motorista/editar/${motorista.id}`}>
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