import { describe, expect, it } from 'vitest'
import { XLSXParserViagem, type DadosViagemPlanilha } from '@/lib/parsers/xlsx-parser'
import { converterNovaViagemParaBD } from '@/lib/services/viagem-data-converter.service'

function criarDadosViagem(parcial: Partial<DadosViagemPlanilha> = {}): DadosViagemPlanilha {
  return {
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
        m3: 12.5,
        sapcode: 'SAP001',
        codewhite: 'WHITE001',
        obs: '',
      },
    ],
    ...parcial,
  }
}

describe('XLSXParserViagem.converterParaFormulario', () => {
  it('repassa numViagem, carreta e tanque como vieram da planilha', () => {
    const resultado = XLSXParserViagem.converterParaFormulario(criarDadosViagem())

    expect(resultado.numViagem).toBe('893892')
    expect(resultado.carreta).toBe('908')
    expect(resultado.tanque).toBe('STCV-28')
  })

  it('usa "0000" como cavalo quando a planilha não traz valor (veículo truck)', () => {
    const resultado = XLSXParserViagem.converterParaFormulario(criarDadosViagem({ cavalo: '' }))
    expect(resultado.cavalo).toBe('0000')
  })

  it('mantém o cavalo informado quando a planilha traz valor', () => {
    const resultado = XLSXParserViagem.converterParaFormulario(criarDadosViagem({ cavalo: '2024' }))
    expect(resultado.cavalo).toBe('2024')
  })

  describe('turno pela hora de início', () => {
    it('define MANHA para horários antes das 16h', () => {
      expect(XLSXParserViagem.converterParaFormulario(criarDadosViagem({ horaInicio: '00:00' })).turno).toBe('MANHA')
      expect(XLSXParserViagem.converterParaFormulario(criarDadosViagem({ horaInicio: '15:59' })).turno).toBe('MANHA')
    })

    it('define NOITE a partir das 16h (inclusive)', () => {
      expect(XLSXParserViagem.converterParaFormulario(criarDadosViagem({ horaInicio: '16:00' })).turno).toBe('NOITE')
      expect(XLSXParserViagem.converterParaFormulario(criarDadosViagem({ horaInicio: '23:00' })).turno).toBe('NOITE')
    })
  })

  it('interpreta o formato DD.MM. com ponto final, típico do SAP', () => {
    const resultado = XLSXParserViagem.converterParaFormulario(criarDadosViagem({ dataInicio: '04.07.' }))
    expect(resultado.inicioPrevisto).toMatch(/^\d{4}-07-04T/)
  })

  describe('cálculo de dias da viagem', () => {
    it('resulta em 1 dia quando início e única entrega são no mesmo dia', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({
          dataInicio: '04.07.2026',
          entregas: [{ dataEntrega: '04.07.2026', cliente: 'X', cidade: 'X', uf: 'SP' }],
        }),
      )
      expect(resultado.diasViagem).toBe(1)
    })

    it('conta os dias até a entrega mais distante quando há entregas em datas diferentes', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({
          dataInicio: '04.07.2026',
          entregas: [
            { dataEntrega: '04.07.2026', cliente: 'A', cidade: 'A', uf: 'SP' },
            { dataEntrega: '06.07.2026', cliente: 'B', cidade: 'B', uf: 'SP' },
          ],
        }),
      )
      expect(resultado.diasViagem).toBe(3) // 4, 5 e 6 de julho
    })
  })

  describe('defaults de entrega', () => {
    it('mantém a cidade vazia quando não vem preenchida (o fallback pro cliente acontece na extração da planilha, não aqui)', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({ entregas: [{ dataEntrega: '04.07.', cliente: 'JOINVILLE', cidade: '', uf: 'SC' }] }),
      )
      expect(resultado.entregas[0].cidade).toBe('')
    })

    it('usa SP como UF padrão quando não vem preenchida', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({ entregas: [{ dataEntrega: '04.07.', cliente: 'X', cidade: 'X', uf: '' }] }),
      )
      expect(resultado.entregas[0].uf).toBe('SP')
    })

    it('zera kg/m3 quando não vêm preenchidos', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({ entregas: [{ dataEntrega: '04.07.', cliente: 'X', cidade: 'X', uf: 'SP' }] }),
      )
      expect(resultado.entregas[0].kg).toBe(0)
      expect(resultado.entregas[0].m3).toBe(0)
    })

    it('usa "0" como sapcode/codewhite padrão quando não vêm preenchidos', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({ entregas: [{ dataEntrega: '04.07.', cliente: 'X', cidade: 'X', uf: 'SP' }] }),
      )
      expect(resultado.entregas[0].sapcode).toBe('0')
      expect(resultado.entregas[0].codewhite).toBe('0')
    })

    it('preenche observação padrão quando vem vazia', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({ entregas: [{ dataEntrega: '04.07.', cliente: 'X', cidade: 'X', uf: 'SP', obs: '' }] }),
      )
      expect(resultado.entregas[0].obs).toBe('Confirmar com a programação antes de sair')
    })

    it('preserva a observação quando ela vem preenchida', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({ entregas: [{ dataEntrega: '04.07.', cliente: 'X', cidade: 'X', uf: 'SP', obs: 'Frágil' }] }),
      )
      expect(resultado.entregas[0].obs).toBe('Frágil')
    })
  })

  it('mantém a ordem e o número de entregas da viagem', () => {
    const resultado = XLSXParserViagem.converterParaFormulario(
      criarDadosViagem({
        entregas: [
          { dataEntrega: '04.07.', cliente: 'JOINVILLE', cidade: 'JOINVILLE', uf: 'SC' },
          { dataEntrega: '05.07.', cliente: 'CURITIBA', cidade: 'CURITIBA', uf: 'PR' },
        ],
      }),
    )

    expect(resultado.entregas).toHaveLength(2)
    expect(resultado.entregas[0].cliente).toBe('JOINVILLE')
    expect(resultado.entregas[1].cliente).toBe('CURITIBA')
  })

  describe('todas as datas são strings, nunca Date (contrato exigido pelas server actions do Next.js)', () => {
    it('inicioPrevisto e fimPrevisto são strings no formato datetime-local', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(criarDadosViagem())

      expect(typeof resultado.inicioPrevisto).toBe('string')
      expect(resultado.inicioPrevisto).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      expect(typeof resultado.fimPrevisto).toBe('string')
      expect(resultado.fimPrevisto).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    })

    it('dataEntrega de cada entrega é string, mesmo com várias entregas', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(
        criarDadosViagem({
          entregas: [
            { dataEntrega: '04.07.', cliente: 'A', cidade: 'A', uf: 'SP' },
            { dataEntrega: '05.07.', cliente: 'B', cidade: 'B', uf: 'SP' },
            { dataEntrega: '06.07.', cliente: 'C', cidade: 'C', uf: 'SP' },
          ],
        }),
      )

      for (const entrega of resultado.entregas) {
        expect(typeof entrega.dataEntrega).toBe('string')
      }
    })

    it('o resultado inteiro é serializável em JSON sem nenhum Date escondido', () => {
      const resultado = XLSXParserViagem.converterParaFormulario(criarDadosViagem())

      let dateEncontrado = false
      JSON.stringify(resultado, (_key, value) => {
        if (value instanceof Date) dateEncontrado = true
        return value
      })

      expect(dateEncontrado).toBe(false)
    })
  })

  it('converte várias viagens do mesmo arquivo mantendo os dados de cada uma', () => {
    const viagem1 = criarDadosViagem({ numViagem: '893892', tanque: 'STCV-28' })
    const viagem2 = criarDadosViagem({
      numViagem: '893897',
      carreta: '6084',
      cavalo: '2063',
      tanque: 'TWM-24',
      entregas: [{ dataEntrega: '04.07.', cliente: 'ROBUSTEC', cidade: 'ROBUSTEC', uf: 'SC' }],
    })

    const resultados = XLSXParserViagem.converterVariasViagensParaFormulario([viagem1, viagem2])

    expect(resultados).toHaveLength(2)
    expect(resultados[0].numViagem).toBe('893892')
    expect(resultados[0].tanque).toBe('STCV-28')
    expect(resultados[1].numViagem).toBe('893897')
    expect(resultados[1].tanque).toBe('TWM-24')
  })
})

describe('integração: planilha → conversão de formulário → conversão para o banco', () => {
  it('produz datas reais (Date) só na etapa final, e diasViagem consistente com o intervalo', () => {
    const dadosFormulario = XLSXParserViagem.converterParaFormulario(
      criarDadosViagem({
        dataInicio: '04.07.2026',
        entregas: [
          { dataEntrega: '04.07.2026', cliente: 'A', cidade: 'A', uf: 'SP' },
          { dataEntrega: '06.07.2026', cliente: 'B', cidade: 'B', uf: 'SP' },
        ],
      }),
    )

    // Antes de chegar no banco, tudo ainda é string (viaja como JSON pela server action)
    expect(typeof dadosFormulario.inicioPrevisto).toBe('string')
    expect(typeof dadosFormulario.fimPrevisto).toBe('string')

    const dadosParaBD = converterNovaViagemParaBD({ ...dadosFormulario, status: 'CRIADA' })

    expect(dadosParaBD.inicioPrevisto instanceof Date).toBe(true)
    expect(dadosParaBD.fimPrevisto instanceof Date).toBe(true)
    for (const entrega of dadosParaBD.entregas) {
      expect(entrega.dataEntrega instanceof Date).toBe(true)
    }

    // O conversor para o banco recalcula diasViagem a partir do intervalo real
    // (fonte de verdade), então deve bater com o que o parser já havia calculado.
    expect(dadosParaBD.diasViagem).toBe(dadosFormulario.diasViagem)
  })
})
