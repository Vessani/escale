'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, AlertTriangle, CheckCircle2, Loader, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { JornadaRelatorioParser, type RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"
import { atualizarJornadaRelatorio, type RespostaImportacaoJornada } from "@/lib/actions/motoristas"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"

export default function ImportarJornadaPage() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState("")
  const [registros, setRegistros] = useState<RegistroJornadaRelatorio[] | null>(null)
  const [resultado, setResultado] = useState<Extract<RespostaImportacaoJornada, { sucesso: true }>["resultado"] | null>(
    null,
  )

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setErro("")
    setResultado(null)
    setRegistros(null)
    setCarregando(true)

    try {
      const dados = await JornadaRelatorioParser.parseFromFile(file)
      setRegistros(dados)
    } catch (erroParse) {
      setErro(erroParse instanceof Error ? erroParse.message : "Erro desconhecido ao processar arquivo.")
    } finally {
      setCarregando(false)
      event.target.value = ""
    }
  }

  const confirmarImportacao = async () => {
    if (!registros) return

    setImportando(true)
    setErro("")

    try {
      const resposta = await atualizarJornadaRelatorio(registros)

      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }

      setResultado(resposta.resultado)
      setRegistros(null)
      router.refresh()
    } catch {
      setErro("Ocorreu um erro inesperado ao importar o relatório.")
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Importar Relatório de Jornada</h1>
          <p className="text-slate-500 mt-1">
            Sobe o Relatório Sintético de Jornada do dia — atualiza o dia de trabalho de cada motorista (coluna &quot;Dias
            Sem Folga&quot;) e o horário habitual de jornada, por matrícula. Motoristas em Férias/Exames/Interno não têm o
            dia sobrescrito.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Arquivo do relatório
          </CardTitle>
          <CardDescription>Formato .xlsx exportado do sistema de ponto/jornada.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={carregando || importando}
              className="sr-only"
              id="jornada-upload"
              aria-label="Upload do relatório de jornada"
            />
            <label
              htmlFor="jornada-upload"
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                carregando ? "bg-slate-50 border-slate-300" : "hover:border-blue-400 hover:bg-blue-50 border-slate-300"
              }`}
            >
              {carregando ? (
                <>
                  <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="mt-2 text-sm font-medium text-slate-600">Processando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="mt-2 text-sm font-medium text-slate-600">Clique para selecionar o arquivo</span>
                </>
              )}
            </label>
          </div>

          {erro && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          {resultado && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{resultado.atualizados} motorista(s) atualizado(s).</p>
                {resultado.naoEncontrados.length > 0 && (
                  <p className="mt-1 text-amber-700">
                    Matrícula(s) sem motorista cadastrado: {resultado.naoEncontrados.join(", ")}
                  </p>
                )}
                {resultado.duplicados.length > 0 && (
                  <p className="mt-1 text-amber-700">
                    Matrícula(s) com mais de um motorista ativo (não atualizadas): {resultado.duplicados.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {registros && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{registros.length} matrícula(s) encontrada(s)</CardTitle>
              <CardDescription>Confira antes de confirmar — a importação atualiza o cadastro dos motoristas.</CardDescription>
            </div>
            <Button
              type="button"
              disabled={importando}
              onClick={confirmarImportacao}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {importando ? "Importando..." : `Confirmar importação`}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Início de Jornada</TableHead>
                    <TableHead>Fim de Jornada</TableHead>
                    <TableHead>Dias Sem Folga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((registro) => (
                    <TableRow key={registro.matricula}>
                      <TableCell>{registro.matricula}</TableCell>
                      <TableCell>{registro.nome}</TableCell>
                      <TableCell>{formatarDataHoraPtBr(registro.inicioJornada)}</TableCell>
                      <TableCell>{formatarDataHoraPtBr(registro.fimJornada)}</TableCell>
                      <TableCell>
                        {registro.diasSemFolga}
                        {registro.diasSemFolga > 6 ? " (capado em 6)" : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Link href="/motorista">
        <Button variant="outline">Voltar pra Motoristas</Button>
      </Link>
    </div>
  )
}
