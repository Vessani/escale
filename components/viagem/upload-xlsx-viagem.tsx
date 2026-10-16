"use client"

import React, { useState } from "react"
import type { NovaViagemFormValues } from "@/lib/validation/viagens"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, AlertCircle, CheckCircle2, Loader } from "lucide-react"
import { MAX_ARQUIVOS_POR_IMPORTACAO, XLSXParserViagem, type ArquivoLido, type DadosViagemPlanilha } from "@/lib/parsers/xlsx-parser"
import { formatarProduto } from "@/lib/services/produto.service"
import { formatarDuracao } from "@/lib/relatorios/formato"

interface UploadXLSXViagemProps {
  onDataLoaded: (dados: NovaViagemFormValues) => void
  onError?: (erro: string) => void
  onImportarLote?: (viagens: NovaViagemFormValues[]) => void | Promise<void>
}

export default function UploadXLSXViagem({ onDataLoaded, onError, onImportarLote }: UploadXLSXViagemProps) {
  const [carregando, setCarregando] = useState(false)
  const [importandoLote, setImportandoLote] = useState(false)
  const [arquivosLidos, setArquivosLidos] = useState<ArquivoLido[]>([])
  const [erro, setErro] = useState<string>("")
  const [sucesso, setSucesso] = useState(false)
  const [viagensDisponiveis, setViagensDisponiveis] = useState<DadosViagemPlanilha[]>([])
  const [numViagemCarregada, setNumViagemCarregada] = useState<string | null>(null)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)

  const carregarViagem = (viagem: DadosViagemPlanilha): void => {
    const dadosFormulario = XLSXParserViagem.converterParaFormulario(viagem)
    setNumViagemCarregada(viagem.numViagem)
    setSucesso(true)
    onDataLoaded(dadosFormulario as NovaViagemFormValues)
  }

  const handleImportarLote = async (): Promise<void> => {
    if (!onImportarLote || viagensDisponiveis.length === 0) return

    setImportandoLote(true)
    try {
      const todasConvertidas = viagensDisponiveis.map((viagem) => XLSXParserViagem.converterParaFormulario(viagem) as NovaViagemFormValues)
      await onImportarLote(todasConvertidas)
    } finally {
      setImportandoLote(false)
    }
  }

  const processarArquivos = async (files: File[]): Promise<void> => {
    setErro("")
    setSucesso(false)
    setViagensDisponiveis([])
    setArquivosLidos([])
    setNumViagemCarregada(null)
    setCarregando(true)

    try {
      const lidos = await XLSXParserViagem.parseVariosArquivos(files)
      // Já vem da mais longa pra mais curta — é a ordem que vai pra sugestão de motorista.
      const viagens = XLSXParserViagem.juntarArquivos(lidos)

      if (viagens.length === 0) {
        throw new Error("Nenhuma viagem encontrada no arquivo")
      }

      setArquivosLidos(lidos)
      setViagensDisponiveis(viagens)
      if (viagens.length > 1) setSucesso(true)

      // Com apenas uma viagem no arquivo, carrega direto no formulário.
      // Com várias, o usuário escolhe qual revisar na lista abaixo.
      if (viagens.length === 1) {
        carregarViagem(viagens[0])
      }
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : "Erro desconhecido ao processar arquivo"
      setErro(mensagem)
      if (onError) onError(mensagem)
    } finally {
      setCarregando(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? [])
    // Limpa o input: escolher os mesmos arquivos de novo (depois de corrigir um) dispara o onChange.
    event.target.value = ""
    if (files.length === 0) return
    await processarArquivos(files)
  }

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    if (!carregando) setArrastandoArquivo(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>): void => {
    event.preventDefault()
    setArrastandoArquivo(false)
  }

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>): Promise<void> => {
    event.preventDefault()
    setArrastandoArquivo(false)
    if (carregando) return

    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length === 0) return
    await processarArquivos(files)
  }

  const handleLimpar = (): void => {
    setArquivosLidos([])
    setErro("")
    setSucesso(false)
    setViagensDisponiveis([])
    setNumViagemCarregada(null)
  }

  return (
    <Card className="shadow-sm border-border mb-6">
      <CardHeader className="bg-muted border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Importar de Arquivo
        </CardTitle>
        <CardDescription>
          Carregue até {MAX_ARQUIVOS_POR_IMPORTACAO} arquivos .xlsx (um por produto) para preencher automaticamente os dados das viagens
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          {/* Zona de upload */}
          <div className="relative">
            <input
              type="file"
              accept=".xlsx"
              multiple
              onChange={handleFileChange}
              disabled={carregando}
              className="sr-only"
              id="xlsx-upload"
              aria-label="Upload de arquivos XLSX"
            />
            <label
              htmlFor="xlsx-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg
                cursor-pointer transition-colors
                ${carregando ? "bg-muted border-border" : "hover:border-primary hover:bg-primary/10"}
                ${arrastandoArquivo ? "border-primary bg-primary/10" : ""}
                ${sucesso ? "border-green-300 bg-green-50" : "border-border"}
                ${erro ? "border-red-300 bg-red-50" : ""}
              `}
            >
              <div className="flex flex-col items-center gap-2">
                {carregando ? (
                  <>
                    <Loader className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-sm font-medium text-foreground/80">Processando...</span>
                  </>
                ) : sucesso ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      {arquivosLidos.length === 1 ? arquivosLidos[0].nomeArquivo : `${arquivosLidos.length} arquivos carregados`}
                    </span>
                  </>
                ) : erro ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <span className="text-sm font-medium text-red-700">{erro}</span>
                  </>
                ) : arrastandoArquivo ? (
                  <>
                    <Upload className="w-8 h-8 text-primary" />
                    <span className="text-sm font-medium text-primary">Solte os arquivos para carregar</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground/80">Clique para selecionar os arquivos</span>
                    <span className="text-xs text-muted-foreground">
                      ou arraste até {MAX_ARQUIVOS_POR_IMPORTACAO} arquivos .xlsx aqui (oxigênio, nitrogênio, argônio...)
                    </span>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* Resumo por arquivo: o produto que saiu do título de cada um */}
          {arquivosLidos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {arquivosLidos.map(({ nomeArquivo, viagens }) => {
                const { produto, tituloProduto } = viagens[0] ?? {}
                return (
                  <li key={nomeArquivo} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
                    <span className="max-w-48 truncate font-medium text-foreground" title={nomeArquivo}>
                      {nomeArquivo}
                    </span>
                    {produto ? (
                      <Badge variant="outline" title={tituloProduto}>
                        {formatarProduto(produto)}
                      </Badge>
                    ) : (
                      <Badge variant="warning">Produto não identificado</Badge>
                    )}
                    <span className="text-muted-foreground">{viagens.length} viagem(ns)</span>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Lista de viagens encontradas, quando os arquivos têm mais de uma */}
          {viagensDisponiveis.length > 1 && (
            <div className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted px-4 py-2">
                <span className="text-sm font-semibold text-foreground/80">
                  {viagensDisponiveis.length} viagens encontradas · da mais longa para a mais curta
                </span>
                {onImportarLote && (
                  <Button type="button" size="sm" disabled={importandoLote} onClick={handleImportarLote}>
                    {importandoLote ? "Importando..." : `Importar todas as ${viagensDisponiveis.length} viagens`}
                  </Button>
                )}
              </div>
              <p className="border-b bg-muted px-4 pb-2 text-xs text-muted-foreground">
                &ldquo;Importar todas&rdquo; calcula a alocação sugerida pra cada viagem e mostra pra você revisar antes de criar. Ou
                escolha uma abaixo para revisar/ajustar os campos antes de salvar individualmente.
              </p>
              <ul className="divide-y divide-border">
                {viagensDisponiveis.map((viagem) => {
                  const carregadaAgora = viagem.numViagem === numViagemCarregada
                  return (
                    <li key={viagem.numViagem} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">
                          Viagem <span className="font-mono tabular-nums">{viagem.numViagem}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {viagem.produto ? `${viagem.tituloProduto ?? formatarProduto(viagem.produto)} · ` : ""}
                          {viagem.entregas.length} parada(s) · início {viagem.dataInicio} {viagem.horaInicio} · duração{" "}
                          {formatarDuracao(XLSXParserViagem.duracaoPrevistaMinutos(viagem))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={carregadaAgora ? "secondary" : "outline"}
                        size="sm"
                        disabled={importandoLote}
                        onClick={() => carregarViagem(viagem)}
                      >
                        {carregadaAgora ? "Carregada ✓" : "Carregar no formulário"}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Botão de limpar */}
          {sucesso && (
            <Button type="button" variant="outline" onClick={handleLimpar} className="w-full">
              Carregar outros arquivos
            </Button>
          )}

          {/* Info sobre o formato esperado */}
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-sm text-primary">
            <strong>Formato esperado:</strong> o &ldquo;Resumo de viagem&rdquo; exportado, com o produto no título (ex.: &ldquo;Oxigênio
            (Sul)&rdquo;) e colunas para: Viagem, Carreta, Cavalo, Data, Hora, SAP Code, White Code, Localização, UF, KG, M3 e Observações.
            Oxigênio Laser e Ultra Puro entram como Oxigênio.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
