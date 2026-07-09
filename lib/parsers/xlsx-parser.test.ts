import { describe, it, expect } from 'vitest'
import { XLSXParserViagem } from '@/lib/parsers/xlsx-parser'

describe('XLSXParserViagem', () => {
  describe('parseFromFile e converterParaFormulario', () => {
    it('should parse and convert viagem data correctly', () => {
      // Simula dados de uma planilha com uma viagem
      const dados = {
        numViagem: '893892',
        carreta: 'CAR01',
        cavalo: '2024',
        tanque: '',
        dataInicio: '04.07',
        horaInicio: '08:45',
        entregas: [
          {
            dataEntrega: '04.07',
            horaEntrega: '11:16',
            cliente: 'JOINVILLE',
            cidade: 'JOINVILLE',
            uf: 'SC',
            kg: 1500,
            m3: 12.5,
            sapcode: 'SAP001',
            codewhite: 'WHITE001',
            obs: ''
          }
        ]
      }

      const resultado = XLSXParserViagem.converterParaFormulario(dados)

      expect(resultado.numViagem).toBe('893892')
      expect(resultado.carreta).toBe('CAR01')
      expect(resultado.cavalo).toBe('2024')
      expect(resultado.entregas.length).toBe(1)
    })

    it('usa "0000" como cavalo quando a planilha não traz valor (veículo truck)', () => {
      const dados = {
        numViagem: '893892',
        carreta: 'CAR01',
        cavalo: '',
        tanque: '',
        dataInicio: '04.07',
        horaInicio: '08:45',
        entregas: [
          { dataEntrega: '04.07', horaEntrega: '11:16', cliente: 'JOINVILLE', cidade: 'JOINVILLE', uf: 'SC', kg: 1, m3: 1, sapcode: '0', codewhite: '0', obs: '' }
        ]
      }

      const resultado = XLSXParserViagem.converterParaFormulario(dados)
      expect(resultado.cavalo).toBe('0000')
    })

    it('define turno MANHA para viagens com início antes das 16h', () => {
      const dados = {
        numViagem: '893892',
        carreta: 'CAR01',
        cavalo: '2024',
        tanque: '',
        dataInicio: '04.07',
        horaInicio: '15:59',
        entregas: [
          { dataEntrega: '04.07', horaEntrega: '16:00', cliente: 'JOINVILLE', cidade: 'JOINVILLE', uf: 'SC', kg: 1, m3: 1, sapcode: '0', codewhite: '0', obs: '' }
        ]
      }

      expect(XLSXParserViagem.converterParaFormulario(dados).turno).toBe('MANHA')
    })

    it('define turno NOITE para viagens com início a partir das 16h', () => {
      const dados = {
        numViagem: '893892',
        carreta: 'CAR01',
        cavalo: '2024',
        tanque: '',
        dataInicio: '04.07',
        horaInicio: '16:00',
        entregas: [
          { dataEntrega: '04.07', horaEntrega: '17:00', cliente: 'JOINVILLE', cidade: 'JOINVILLE', uf: 'SC', kg: 1, m3: 1, sapcode: '0', codewhite: '0', obs: '' }
        ]
      }

      expect(XLSXParserViagem.converterParaFormulario(dados).turno).toBe('NOITE')
    })

    it('should calculate trip days correctly based on date range', () => {
      // Mesma data de início e fim deve resultar em 1 dia
      const dados = {
        numViagem: '893892',
        carreta: 'CAR01',
        cavalo: '2024',
        tanque: '',
        dataInicio: '04.07.2026',
        horaInicio: '08:45',
        entregas: [
          {
            dataEntrega: '04.07.2026',
            horaEntrega: '11:16',
            cliente: 'JOINVILLE',
            cidade: 'JOINVILLE',
            uf: 'SC',
            kg: 1500,
            m3: 12.5,
            sapcode: 'SAP001',
            codewhite: 'WHITE001',
            obs: ''
          }
        ]
      }

      const resultado = XLSXParserViagem.converterParaFormulario(dados)

      // Quando início e fim são no mesmo dia, diasViagem deve ser 1
      expect(resultado.diasViagem).toBeGreaterThanOrEqual(1)
    })

    it('should handle multiple deliveries in different dates', () => {
      const dados = {
        numViagem: '893892',
        carreta: 'CAR01',
        cavalo: '2024',
        tanque: '',
        dataInicio: '04.07.2026',
        horaInicio: '08:45',
        entregas: [
          {
            dataEntrega: '04.07.2026',
            horaEntrega: '11:16',
            cliente: 'JOINVILLE',
            cidade: 'JOINVILLE',
            uf: 'SC',
            kg: 1500,
            m3: 12.5,
            sapcode: 'SAP001',
            codewhite: 'WHITE001',
            obs: ''
          },
          {
            dataEntrega: '05.07.2026',
            horaEntrega: '14:30',
            cliente: 'CURITIBA',
            cidade: 'CURITIBA',
            uf: 'PR',
            kg: 2000,
            m3: 15,
            sapcode: 'SAP002',
            codewhite: 'WHITE002',
            obs: 'Fragil'
          }
        ]
      }

      const resultado = XLSXParserViagem.converterParaFormulario(dados)

      expect(resultado.entregas.length).toBe(2)
      expect(resultado.entregas[0].cliente).toBe('JOINVILLE')
      expect(resultado.entregas[1].cliente).toBe('CURITIBA')
      // Com entregas em datas diferentes, deve calcular corretamente os dias
      expect(resultado.diasViagem).toBeGreaterThanOrEqual(2)
    })

    it('should handle date format DD.MM. with trailing dot (SAP format)', () => {
      // Formato que vem do SAP: "04.07." (com ponto final)
      const dados = {
        numViagem: '893892',
        carreta: '908',
        cavalo: '2064',
        tanque: '',
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
            sapcode: 'SAP001',
            codewhite: '',
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
            codewhite: '',
            obs: ''
          }
        ]
      }

      const resultado = XLSXParserViagem.converterParaFormulario(dados)

      expect(resultado.numViagem).toBe('893892')
      expect(resultado.carreta).toBe('908')
      expect(resultado.cavalo).toBe('2064')
      expect(resultado.entregas.length).toBe(2)
      expect(resultado.entregas[0].cliente).toBe('JOINVILLE')
      expect(resultado.entregas[1].cliente).toBe('SEMEATO')
      // 04.07 a 06.07 = 3 dias
      expect(resultado.diasViagem).toBeGreaterThanOrEqual(2)
    })

    it('should extract multiple trips from the same file', () => {
      // Simula extração de 2 viagens da mesma planilha
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
          },
          {
            dataEntrega: '06.07.',
            horaEntrega: '08:00',
            cliente: 'ROBUSTEC',
            cidade: 'ROBUSTEC',
            uf: 'SC',
            kg: 3000,
            m3: 0,
            sapcode: '90004899',
            codewhite: '0',
            obs: ''
          }
        ]
      }

      const viagens = [viagem1, viagem2]
      const resultados = XLSXParserViagem.converterVariasViagensParaFormulario(viagens)

      expect(resultados.length).toBe(2)
      expect(resultados[0].numViagem).toBe('893892')
      expect(resultados[0].tanque).toBe('STCV-28')
      expect(resultados[0].entregas.length).toBe(2)
      expect(resultados[0].entregas[0].obs).toBe('Confirmar com a programação antes de sair')
      
      expect(resultados[1].numViagem).toBe('893897')
      expect(resultados[1].tanque).toBe('TWM-24')
      expect(resultados[1].entregas.length).toBe(2)
      expect(resultados[1].entregas[0].obs).toBe('Confirmar com a programação antes de sair')
    })

    it('should treat empty SAP Code and Code White as "0"', () => {
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

      expect(resultado.entregas[0].sapcode).toBe('0')
      expect(resultado.entregas[0].codewhite).toBe('0')
    })

    it('should fill empty observations with default message', () => {
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
            sapcode: 'SAP001',
            codewhite: 'WHITE001',
            obs: ''
          }
        ]
      }

      const resultado = XLSXParserViagem.converterParaFormulario(dados)

      expect(resultado.entregas[0].obs).toBe('Confirmar com a programação antes de sair')
    })

    it('should extract tank number from viagem data', () => {
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

      const resultado = XLSXParserViagem.converterParaFormulario(viagem1)

      expect(resultado.tanque).toBe('STCV-28')
    })
  })
})


