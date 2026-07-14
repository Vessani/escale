'use client'

import React, { useState } from 'react'
import type { NovaViagemFormValues } from '@/lib/validation/viagens'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, AlertCircle, CheckCircle2, Loader } from 'lucide-react'
import { XLSXParserViagem, type DadosViagemPlanilha } from '@/lib/parsers/xlsx-parser'

interface UploadXLSXViagemProps {
  onDataLoaded: (dados: NovaViagemFormValues) => void
  onError?: (erro: string) => void
  onImportarLote?: (viagens: NovaViagemFormValues[]) => void | Promise<void>
}

export default function UploadXLSXViagem({ onDataLoaded, onError, onImportarLote }: UploadXLSXViagemProps) {
  const [carregando, setCarregando] = useState(false)
  const [importandoLote, setImportandoLote] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string>('')
  const [sucesso, setSucesso] = useState(false)
  const [viagensDisponiveis, setViagensDisponiveis] = useState<DadosViagemPlanilha[]>([])
  const [numViagemCarregada, setNumViagemCarregada] = useState<string | null>(null)

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
      const todasConvertidas = viagensDisponiveis.map(
        (viagem) => XLSXParserViagem.converterParaFormulario(viagem) as NovaViagemFormValues,
      )
      await onImportarLote(todasConvertidas)
    } finally {
      setImportandoLote(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    setErro('')
    setSucesso(false)
    setViagensDisponiveis([])
    setNumViagemCarregada(null)
    setCarregando(true)

    try {
      const viagens = await XLSXParserViagem.parseFromFile(file)

      if (viagens.length === 0) {
        throw new Error('Nenhuma viagem encontrada no arquivo')
      }

      setArquivo(file)
      setViagensDisponiveis(viagens)

      // Com apenas uma viagem no arquivo, carrega direto no formulário.
      // Com várias, o usuário escolhe qual revisar na lista abaixo.
      if (viagens.length === 1) {
        carregarViagem(viagens[0])
      }
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao processar arquivo'
      setErro(mensagem)
      if (onError) onError(mensagem)
    } finally {
      setCarregando(false)
    }
  }

  const handleLimpar = (): void => {
    setArquivo(null)
    setErro('')
    setSucesso(false)
    setViagensDisponiveis([])
    setNumViagemCarregada(null)
  }

  return (
    <Card className="shadow-sm border-slate-200 mb-6">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Importar de Arquivo
        </CardTitle>
        <CardDescription>
          Carregue um arquivo .xlsx para preencher automaticamente os dados da viagem
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">

          {/* Zona de upload */}
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={carregando}
              className="sr-only"
              id="xlsx-upload"
              aria-label="Upload de arquivo XLSX"
            />
            <label
              htmlFor="xlsx-upload"
              className={`
                flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg
                cursor-pointer transition-colors
                ${carregando ? 'bg-slate-50 border-slate-300' : 'hover:border-blue-400 hover:bg-blue-50'}
                ${sucesso ? 'border-green-300 bg-green-50' : 'border-slate-300'}
                ${erro ? 'border-red-300 bg-red-50' : ''}
              `}
            >
              <div className="flex flex-col items-center gap-2">
                {carregando ? (
                  <>
                    <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-slate-600">Processando...</span>
                  </>
                ) : sucesso ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      {arquivo?.name || 'Arquivo carregado'}
                    </span>
                  </>
                ) : erro ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <span className="text-sm font-medium text-red-700">{erro}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">
                      Clique para selecionar arquivo
                    </span>
                    <span className="text-xs text-slate-500">
                      ou arraste um arquivo .xlsx aqui
                    </span>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* Lista de viagens encontradas, quando o arquivo tem mais de uma */}
          {viagensDisponiveis.length > 1 && (
            <div className="rounded-lg border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-2">
                <span className="text-sm font-semibold text-slate-700">
                  {viagensDisponiveis.length} viagens encontradas no arquivo
                </span>
                {onImportarLote && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={importandoLote}
                    onClick={handleImportarLote}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {importandoLote
                      ? "Importando..."
                      : `Importar todas as ${viagensDisponiveis.length} viagens`}
                  </Button>
                )}
              </div>
              <p className="border-b bg-slate-50 px-4 pb-2 text-xs text-slate-500">
                &ldquo;Importar todas&rdquo; calcula a alocação sugerida pra cada viagem e mostra pra você revisar
                antes de criar. Ou escolha uma abaixo para revisar/ajustar os campos antes de salvar individualmente.
              </p>
              <ul className="divide-y divide-slate-100">
                {viagensDisponiveis.map((viagem) => {
                  const carregadaAgora = viagem.numViagem === numViagemCarregada
                  return (
                    <li key={viagem.numViagem} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-slate-900">Viagem {viagem.numViagem}</div>
                        <div className="text-xs text-slate-500">
                          {viagem.entregas.length} entrega(s) · início {viagem.dataInicio}
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
            <Button
              type="button"
              variant="outline"
              onClick={handleLimpar}
              className="w-full"
            >
              Carregar outro arquivo
            </Button>
          )}

          {/* Info sobre o formato esperado */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            <strong>Formato esperado:</strong> A planilha deve conter dados de viagem com colunas para:
            Viagem, Carreta, Cavalo, Data, Hora, SAP Code, White Code, Data Entrega, Localização, UF, KG, M3 e Observações.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
