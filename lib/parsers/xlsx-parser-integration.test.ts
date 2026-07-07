import { describe, it, expect } from 'vitest'
import { converterNovaViagemParaBD } from '@/lib/services/viagem-data-converter.service'
import { XLSXParserViagem } from '@/lib/parsers/xlsx-parser'

/**
 * TESTE DE INTEGRAÇÃO: Fluxo completo XLSX → Parser → Converter → Action
 * Verifica se em nenhum ponto do pipeline há Date objects que possam quebrar a serialização
 */
describe('Integration: XLSX Parser → Converter → Server Action', () => {
  it('should not have Date objects anywhere in the flow', () => {
    // 1. Simula dados do XLSX (como viriam do arquivo)
    const dadosXLSX = {
      numViagem: '893892',
      carreta: '908',
      cavalo: '2064',
      tanque: 'STCV-28',
      dataInicio: '04.07.',
      horaInicio: '08:45',
      entregas: [
        {
          dataEntrega: '04.07.',
          horaEntrega: '11:16',
          cliente: 'JOINVILLE',
          cidade: 'JOINVILLE',
          uf: 'SC',
          kg: 1500,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        },
        {
          dataEntrega: '06.07.',
          horaEntrega: '10:00',
          cliente: 'SEMEATO',
          cidade: 'SEMEATO',
          uf: 'PR',
          kg: 2000,
          m3: 0,
          sapcode: '90003246',
          codewhite: '0',
          obs: ''
        }
      ]
    }

    // 2. Parser converte para formato de formulário
    const dadosFormulario = XLSXParserViagem.converterParaFormulario(dadosXLSX)
    console.log('Após Parser:', JSON.stringify(dadosFormulario, null, 2))

    // ✅ Verificar que parser retorna strings
    expect(typeof dadosFormulario.inicioPrevisto).toBe('string')
    expect(typeof dadosFormulario.fimPrevisto).toBe('string')
    dadosFormulario.entregas.forEach((e, i) => {
      expect(typeof e.dataEntrega, `entrega ${i}`).toBe('string')
    })

    // 3. Simula o que React Hook Form faria (receberia do parser)
    // Assumindo que form.reset() não transforma os dados
    const dadosDoFormulario = { ...dadosFormulario }

    // ✅ Verificar que após formulário ainda são strings
    expect(typeof dadosDoFormulario.inicioPrevisto).toBe('string')
    expect(typeof dadosDoFormulario.fimPrevisto).toBe('string')
    dadosDoFormulario.entregas.forEach((e, i) => {
      expect(typeof e.dataEntrega, `entrega ${i} após form`).toBe('string')
    })

    // 4. Simula o que a action faz: converter de strings → Dates
    const dadosConvertidos = converterNovaViagemParaBD(dadosDoFormulario)

    // ✅ AGORA SIM devem ser Date objects (já passou da serialização do Next.js)
    expect(dadosConvertidos.inicioPrevisto instanceof Date).toBe(true)
    expect(dadosConvertidos.fimPrevisto instanceof Date).toBe(true)
    dadosConvertidos.entregas.forEach((e, i) => {
      expect(e.dataEntrega instanceof Date, `entrega ${i} não é Date após converter`).toBe(true)
    })

    // 5. Simula serialização do Next.js (deve passar sem erros)
    let dateObjectsEmBeforeSerialization = 0
    JSON.stringify(dadosDoFormulario, (_, value) => {
      if (value instanceof Date) {
        dateObjectsEmBeforeSerialization++
        console.error(`❌ Date object encontrado ANTES da serialização: ${value}`)
      }
      return value
    })

    expect(dateObjectsEmBeforeSerialization, 'Não deve haver Date objects ao serializar para Next.js').toBe(0)
  })

  it('should track all 7 date fields through the flow', () => {
    const dadosXLSX = {
      numViagem: '893892',
      carreta: '908',
      cavalo: '2064',
      tanque: 'STCV-28',
      dataInicio: '04.07.',
      horaInicio: '08:45',
      entregas: [
        {
          dataEntrega: '04.07.',
          horaEntrega: '11:16',
          cliente: 'JOINVILLE',
          cidade: 'JOINVILLE',
          uf: 'SC',
          kg: 1500,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        },
        {
          dataEntrega: '05.07.',
          horaEntrega: '12:00',
          cliente: 'CURITIBA',
          cidade: 'CURITIBA',
          uf: 'PR',
          kg: 2000,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        },
        {
          dataEntrega: '06.07.',
          horaEntrega: '14:00',
          cliente: 'SEMEATO',
          cidade: 'SEMEATO',
          uf: 'PR',
          kg: 2000,
          m3: 0,
          sapcode: '90003246',
          codewhite: '0',
          obs: ''
        },
        {
          dataEntrega: '07.07.',
          horaEntrega: '10:00',
          cliente: 'JOINVILLE',
          cidade: 'JOINVILLE',
          uf: 'SC',
          kg: 1500,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        },
        {
          dataEntrega: '08.07.',
          horaEntrega: '11:00',
          cliente: 'SEMEATO',
          cidade: 'SEMEATO',
          uf: 'PR',
          kg: 1000,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        }
      ]
    }

    const dadosFormulario = XLSXParserViagem.converterParaFormulario(dadosXLSX)

    // ✅ Contar todos os 7 campos de data
    // 1. inicioPrevisto
    // 2. fimPrevisto
    // 3-7. dataEntrega (5 entregas)
    let countStringDates = 0

    if (typeof dadosFormulario.inicioPrevisto === 'string') countStringDates++
    if (typeof dadosFormulario.fimPrevisto === 'string') countStringDates++
    dadosFormulario.entregas.forEach(e => {
      if (typeof e.dataEntrega === 'string') countStringDates++
    })

    expect(countStringDates, `Esperado 7 strings de data, encontrou ${countStringDates}`).toBe(7)

    // ✅ Simular serialização (não deve quebrar)
    const jsonStr = JSON.stringify(dadosFormulario)
    expect(jsonStr).toBeTruthy()
    expect(jsonStr).toContain('2026-07')
  })
})
