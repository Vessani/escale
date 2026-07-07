import { describe, it, expect } from 'vitest'
import { XLSXParserViagem } from '@/lib/parsers/xlsx-parser'

/**
 * TESTE CRÍTICO: Verifica se o parser retorna STRINGS (não Date objects)
 * Este é o problema raiz do erro "7 items not stringified"
 */
describe('Serialization - Verify all dates are strings', () => {
  it('should return inicioPrevisto as STRING (not Date object)', () => {
    const dados = {
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
        }
      ]
    }

    const resultado = XLSXParserViagem.converterParaFormulario(dados)

    // ✅ CRÍTICO: deve ser string, não Date
    expect(typeof resultado.inicioPrevisto).toBe('string')
    expect(resultado.inicioPrevisto).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('should return fimPrevisto as STRING (not Date object)', () => {
    const dados = {
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
          horaEntrega: '14:00',
          cliente: 'OUTRA',
          cidade: 'OUTRA',
          uf: 'PR',
          kg: 1000,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        }
      ]
    }

    const resultado = XLSXParserViagem.converterParaFormulario(dados)

    // ✅ CRÍTICO: deve ser string, não Date
    expect(typeof resultado.fimPrevisto).toBe('string')
    expect(resultado.fimPrevisto).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('should return all entrega dataEntrega as STRING (not Date object)', () => {
    const dados = {
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
          horaEntrega: '14:30',
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
          horaEntrega: '09:00',
          cliente: 'SEMEATO',
          cidade: 'SEMEATO',
          uf: 'PR',
          kg: 3000,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        }
      ]
    }

    const resultado = XLSXParserViagem.converterParaFormulario(dados)

    // ✅ CRÍTICO: todas as entregas devem ter dataEntrega como string
    resultado.entregas.forEach((entrega, index) => {
      expect(typeof entrega.dataEntrega, `entrega ${index} dataEntrega é ${typeof entrega.dataEntrega}`).toBe('string')
      expect(entrega.dataEntrega, `entrega ${index} formato inválido: ${entrega.dataEntrega}`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    })
  })

  it('should be JSON serializable (no Date objects hiding)', () => {
    const dados = {
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
        }
      ]
    }

    const resultado = XLSXParserViagem.converterParaFormulario(dados)

    // ✅ Simula o que Next.js faz
    let dateObjectsFound = 0
    const jsonString = JSON.stringify(resultado, (_, value) => {
      if (value instanceof Date) {
        dateObjectsFound++
        console.error(`❌ Found Date object: ${value}`)
      }
      return value
    })

    expect(dateObjectsFound, 'Não deve haver Date objects').toBe(0)
    expect(jsonString).toBeTruthy()
  })

  it('should handle multiple trips (array) with all strings', () => {
    const viagem1 = {
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
        }
      ]
    }

    const viagem2 = {
      numViagem: '893897',
      carreta: '6084',
      cavalo: '2063',
      tanque: 'TWM-24',
      dataInicio: '04.07.',
      horaInicio: '14:45',
      entregas: [
        {
          dataEntrega: '04.07.',
          horaEntrega: '14:46',
          cliente: 'JOINVILLE',
          cidade: 'JOINVILLE',
          uf: 'SC',
          kg: 0,
          m3: 0,
          sapcode: '0',
          codewhite: '0',
          obs: ''
        }
      ]
    }

    const viagens = [viagem1, viagem2]
    const resultados = XLSXParserViagem.converterVariasViagensParaFormulario(viagens)

    // ✅ Ambas as viagens devem ter strings
    resultados.forEach((viagem, tripIndex) => {
      expect(typeof viagem.inicioPrevisto).toBe('string')
      expect(typeof viagem.fimPrevisto).toBe('string')
      viagem.entregas.forEach((entrega, entregaIndex) => {
        expect(typeof entrega.dataEntrega, `Trip ${tripIndex} entrega ${entregaIndex} dataEntrega`).toBe('string')
      })
    })
  })
})
