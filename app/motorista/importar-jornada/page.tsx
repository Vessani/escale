'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader, Upload } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { JornadaRelatorioParser, type RegistroJornadaRelatorio } from "@/lib/parsers/jornada-relatorio-parser"
import { atualizarJornadaRelatorio, type RespostaImportacaoJornada } from "@/lib/actions/motoristas"
import { formatarDataHoraPtBr } from "@/lib/utils/date-format"
import { MAX_DIAS_SEM_FOLGA, folgaEstourada } from "@/lib/services/dias-sem-folga"

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
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Importar Relatório de Jornada</h1>
          <p
            className="text-muted-foreground mt-1"
            title='Sobe o Relatório Sintético de Jornada do dia — atualiza o dia de trabalho de cada motorista (coluna "Dias Sem Folga") e o horário habitual de jornada, por matrícula. Motoristas em Férias/Exames/Interno não têm o dia sobrescrito.'
          >
            Atualiza o dia de trabalho e o horário de jornada, por matrícula.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="bg-muted border-b">
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
                carregando ? "bg-muted border-border" : "hover:border-primary hover:bg-primary/10 border-border"
              }`}
            >
              {carregando ? (
                <>
                  <Loader className="w-8 h-8 text-primary animate-spin" />
                  <span className="mt-2 text-sm font-medium text-foreground/80">Processando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="mt-2 text-sm font-medium text-foreground/80">Clique para selecionar o arquivo</span>
                </>
              )}
            </label>
          </div>

          {erro && <Alert variant="error">{erro}</Alert>}

          {resultado && (
            <Alert variant="success">
              <div>
                <p className="font-medium">{resultado.atualizados} motorista(s) atualizado(s).</p>
                {resultado.naoEncontrados.length > 0 && (
                  <p className="mt-1 text-warning">
                    Matrícula(s) sem motorista cadastrado: {resultado.naoEncontrados.join(", ")}
                  </p>
                )}
                {resultado.duplicados.length > 0 && (
                  <p className="mt-1 text-warning">
                    Matrícula(s) com mais de um motorista ativo (não atualizadas): {resultado.duplicados.join(", ")}
                  </p>
                )}
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {registros && (
        <Card className="shadow-sm border-border">
          <CardHeader className="bg-muted border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {new Set(registros.map((r) => r.matricula)).size} motorista(s) — {registros.length} jornada(s) encontrada(s)
              </CardTitle>
              <CardDescription>Confira antes de confirmar — a importação atualiza o cadastro dos motoristas e o histórico do calendário.</CardDescription>
            </div>
            <Button
              type="button"
              disabled={importando}
              onClick={confirmarImportacao}
            >
              {importando ? "Importando..." : `Confirmar importação`}
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {registros.some((registro) => folgaEstourada(registro.diasSemFolga)) && (
              <Alert variant="error">
                {registros.filter((registro) => folgaEstourada(registro.diasSemFolga)).length} jornada(s) passaram de{" "}
                {MAX_DIAS_SEM_FOLGA} dias seguidos sem folga (em vermelho). Elas ficam registradas em Relatórios → Estouro de 7º dia.
              </Alert>
            )}
            <div className="overflow-hidden rounded-md border">
              <Table containerClassName="max-h-96 overflow-auto">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Início de Jornada</TableHead>
                    <TableHead>Fim de Jornada</TableHead>
                    <TableHead>Dias Sem Folga</TableHead>
                    <TableHead>Correção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((registro) => (
                    <TableRow
                      key={`${registro.matricula}-${registro.dia}`}
                      className={
                        folgaEstourada(registro.diasSemFolga)
                          ? "bg-destructive/10 text-destructive hover:bg-destructive/15 font-medium"
                          : undefined
                      }
                    >
                      <TableCell className="font-mono tabular-nums">{registro.matricula}</TableCell>
                      <TableCell>{registro.nome}</TableCell>
                      <TableCell className="font-mono tabular-nums">{formatarDataHoraPtBr(registro.inicioJornada)}</TableCell>
                      <TableCell className="font-mono tabular-nums">{formatarDataHoraPtBr(registro.fimJornada)}</TableCell>
                      <TableCell className="tabular-nums">
                        {folgaEstourada(registro.diasSemFolga) ? (
                          <span title={`Trabalhou ${registro.diasSemFolga} dias seguidos sem folga — o limite é ${MAX_DIAS_SEM_FOLGA}. No calendário do Escale o dia fica como ${MAX_DIAS_SEM_FOLGA}º (o código 7 é Folga).`}>
                            {registro.diasSemFolga}º dia sem folga
                          </span>
                        ) : (
                          registro.diasSemFolga
                        )}
                        {registro.diasSemFolga !== registro.diasSemFolgaRelatorio && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (relatório: {registro.diasSemFolgaRelatorio})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {registro.correcao === "BATIDAS_UNIDAS" && (
                          <Badge
                            variant="warning"
                            title="Entrada e saída vieram em linhas separadas no relatório e foram juntadas numa jornada só."
                          >
                            Batidas unidas
                          </Badge>
                        )}
                        {registro.correcao === "BATIDA_SEM_PAR" && (
                          <Badge
                            variant="outline"
                            title="Só uma batida (entrada ou saída). Conta como dia trabalhado, mas o horário de fim pode não ser o real."
                          >
                            Batida sem par
                          </Badge>
                        )}
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
