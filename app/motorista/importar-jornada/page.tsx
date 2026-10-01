'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader, Upload } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  JornadaRelatorioParser,
  type LinhaJornadaBruta,
  type RegistroJornadaRelatorio,
} from "@/lib/parsers/jornada-relatorio-parser"
import { atualizarJornadaRelatorio, type RespostaImportacaoJornada } from "@/lib/actions/motoristas"
import type { AjusteJornada } from "@/lib/validation/ajuste-jornada"
import { ConferenciaJornada } from "./conferencia-jornada"

export default function ImportarJornadaPage() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState("")
  const [brutas, setBrutas] = useState<LinhaJornadaBruta[] | null>(null)
  const [resultado, setResultado] = useState<Extract<RespostaImportacaoJornada, { sucesso: true }>["resultado"] | null>(
    null,
  )

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setErro("")
    setResultado(null)
    setBrutas(null)
    setCarregando(true)

    try {
      setBrutas(await JornadaRelatorioParser.lerArquivo(file))
    } catch (erroParse) {
      setErro(erroParse instanceof Error ? erroParse.message : "Erro desconhecido ao processar arquivo.")
    } finally {
      setCarregando(false)
      event.target.value = ""
    }
  }

  const confirmarImportacao = async (registros: RegistroJornadaRelatorio[], ajustes: AjusteJornada[]) => {
    setImportando(true)
    setErro("")

    try {
      const resposta = await atualizarJornadaRelatorio(registros, ajustes)

      if (!resposta.sucesso) {
        setErro(resposta.erro)
        return
      }

      setResultado(resposta.resultado)
      setBrutas(null)
      router.refresh()
    } catch {
      setErro("Ocorreu um erro inesperado ao importar o relatório.")
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
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
              className={`flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                brutas ? "flex-row gap-2 p-3 [&>span]:mt-0" : "flex-col p-8"
              } ${
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
                  <Upload className={brutas ? "w-5 h-5 text-muted-foreground" : "w-8 h-8 text-muted-foreground"} />
                  <span className="mt-2 text-sm font-medium text-foreground/80">
                    {brutas ? "Trocar arquivo (as correções feitas aqui se perdem)" : "Clique para selecionar o arquivo"}
                  </span>
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

      {brutas && <ConferenciaJornada key={brutas.length + (brutas[0]?.inicio ?? "")} brutas={brutas} importando={importando} onConfirmar={confirmarImportacao} />}

      <Link href="/motorista">
        <Button variant="outline">Voltar pra Motoristas</Button>
      </Link>
    </div>
  )
}
