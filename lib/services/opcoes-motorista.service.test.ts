import { describe, expect, it } from "vitest"
import { montarOpcoesDaEdicao, montarOpcoesMotoristaPorViagem, type AgendaDoFormulario } from "./opcoes-motorista.service"

const HOJE = new Date("2026-09-30T00:00:00-03:00")

function motorista(parcial: Record<string, unknown> = {}) {
  return {
    id: 1,
    nome: "ANA",
    turno: "MANHA" as const,
    diasTrabalhados: 1,
    tipo: "MOTORISTA" as const,
    produtosAutorizados: ["CO2" as const],
    jornadaRelatorioInicio: null,
    jornadaRelatorioFim: null,
    integracao: [],
    registrosJornada: [],
    viagens: [],
    ...parcial,
  }
}

const VIAGEM = {
  id: 10,
  turno: "MANHA" as const,
  diasViagem: 1,
  inicioPrevisto: new Date("2026-09-30T08:00:00-03:00"),
  fimPrevisto: new Date("2026-09-30T18:00:00-03:00"),
  integracaoExigida: null,
  produto: "CO2" as const,
}

describe("montarOpcoesMotoristaPorViagem", () => {
  it("devolve só id, nome, tipo e situação — nada de agenda ou histórico pro navegador", () => {
    const opcoes = montarOpcoesMotoristaPorViagem([motorista()], [VIAGEM], HOJE).get(10)

    expect(opcoes).toEqual([{ id: 1, nome: "ANA", tipo: "MOTORISTA", situacao: "OK", motivo: "6 dias disponíveis" }])
  })

  it("ignora a própria viagem na agenda — quem já está nela não aparece ocupado", () => {
    const naPropriaViagem = motorista({
      viagens: [{ id: 10, status: "ALOCADA", inicioPrevisto: VIAGEM.inicioPrevisto, fimPrevisto: VIAGEM.fimPrevisto }],
    })
    const emOutraViagem = motorista({
      id: 2,
      nome: "BRUNO",
      viagens: [{ id: 99, status: "ALOCADA", inicioPrevisto: VIAGEM.inicioPrevisto, fimPrevisto: VIAGEM.fimPrevisto }],
    })

    const opcoes = montarOpcoesMotoristaPorViagem([naPropriaViagem, emOutraViagem], [VIAGEM], HOJE).get(10)

    expect(opcoes?.map((opcao) => opcao.situacao)).toEqual(["OK", "SEM_DESCANSO"])
    expect(opcoes?.[1].motivo).toBe("Em viagem até 30/09 18:00")
  })

  it("laranja diz até quando vai o descanso (11h, ou 35h depois do 6º dia)", () => {
    const ontem = motorista({
      viagens: [
        {
          id: 98,
          status: "FINALIZADA",
          inicioPrevisto: new Date("2026-09-29T14:00:00-03:00"),
          fimPrevisto: new Date("2026-09-30T00:00:00-03:00"),
        },
      ],
    })
    const opcoes = montarOpcoesMotoristaPorViagem([ontem], [VIAGEM], HOJE).get(10)
    expect(opcoes?.[0]).toMatchObject({ situacao: "SEM_DESCANSO", motivo: "Descanso até 30/09 11:00" })
  })

  it("marca fora da regra quem é de outro turno", () => {
    const opcoes = montarOpcoesMotoristaPorViagem([motorista({ turno: "NOITE" })], [VIAGEM], HOJE).get(10)

    expect(opcoes?.[0].situacao).toBe("FORA_DA_REGRA")
    expect(opcoes?.[0].motivo).toBe("Turno Noite")
  })
})

describe("montarOpcoesDaEdicao — lista acompanhando o formulário antes de salvar", () => {
  const VIAGEM_SALVA = { ...VIAGEM, entregas: [{ sapcode: "90001" }] }
  const SEM_SAP = new Set<string>()
  /** BRUNO tem outra viagem no mesmo horário da viagem salva. */
  const ocupadoNoHorarioSalvo = motorista({
    id: 2,
    nome: "BRUNO",
    viagens: [{ id: 99, status: "ALOCADA", inicioPrevisto: VIAGEM.inicioPrevisto, fimPrevisto: VIAGEM.fimPrevisto }],
  })
  const agenda = (parcial: Partial<AgendaDoFormulario> = {}): AgendaDoFormulario => ({
    inicioPrevisto: VIAGEM.inicioPrevisto,
    fimPrevisto: VIAGEM.fimPrevisto,
    turno: VIAGEM.turno,
    produto: VIAGEM.produto,
    ...parcial,
  })

  it("sem agenda, é a viagem como está salva (abertura da tela)", () => {
    const opcoes = montarOpcoesDaEdicao([motorista(), ocupadoNoHorarioSalvo], VIAGEM_SALVA, SEM_SAP, HOJE)
    expect(opcoes.map((opcao) => opcao.situacao)).toEqual(["OK", "SEM_DESCANSO"])
  })

  it("mudar as datas pra depois da outra viagem libera o motorista na hora", () => {
    const doisDiasDepois = agenda({
      inicioPrevisto: new Date("2026-10-02T08:00:00-03:00"),
      fimPrevisto: new Date("2026-10-02T18:00:00-03:00"),
    })
    const [, bruno] = montarOpcoesDaEdicao([motorista(), ocupadoNoHorarioSalvo], VIAGEM_SALVA, SEM_SAP, HOJE, doisDiasDepois)
    expect(bruno).toMatchObject({ id: 2, situacao: "OK" })
  })

  it("esticar a viagem por cima da agenda de alguém marca ele como sem descanso", () => {
    const amanha = motorista({
      viagens: [
        {
          id: 77,
          status: "ALOCADA",
          inicioPrevisto: new Date("2026-10-01T08:00:00-03:00"),
          fimPrevisto: new Date("2026-10-01T18:00:00-03:00"),
        },
      ],
    })
    expect(montarOpcoesDaEdicao([amanha], VIAGEM_SALVA, SEM_SAP, HOJE)[0].situacao).toBe("OK")

    const ateAmanha = agenda({ fimPrevisto: new Date("2026-10-01T12:00:00-03:00") })
    expect(montarOpcoesDaEdicao([amanha], VIAGEM_SALVA, SEM_SAP, HOJE, ateAmanha)[0].situacao).toBe("SEM_DESCANSO")
  })

  it("trocar turno ou produto no formulário muda quem cabe na regra", () => {
    expect(montarOpcoesDaEdicao([motorista()], VIAGEM_SALVA, SEM_SAP, HOJE, agenda({ turno: "NOITE" }))[0]).toMatchObject({
      situacao: "FORA_DA_REGRA",
      motivo: "Turno Dia",
    })
    expect(montarOpcoesDaEdicao([motorista()], VIAGEM_SALVA, SEM_SAP, HOJE, agenda({ produto: "OXIGENIO" }))[0]).toMatchObject({
      situacao: "FORA_DA_REGRA",
      motivo: "Produto não autorizado",
    })
  })

  it("dias da viagem saem das datas do formulário, não do número salvo", () => {
    // Ciclo no 5º dia: cabe 1 dia de viagem, mas não 3.
    const quintoDia = motorista({ diasTrabalhados: 5 })
    const tresDias = agenda({ fimPrevisto: new Date("2026-10-02T18:00:00-03:00") })
    expect(montarOpcoesDaEdicao([quintoDia], VIAGEM_SALVA, SEM_SAP, HOJE)[0].situacao).toBe("OK")
    expect(montarOpcoesDaEdicao([quintoDia], VIAGEM_SALVA, SEM_SAP, HOJE, tresDias)[0].situacao).toBe("FORA_DA_REGRA")
  })

  it("integração exigida sai das entregas quando a viagem não tem gravada", () => {
    const opcoes = montarOpcoesDaEdicao([motorista()], VIAGEM_SALVA, new Set(["90001"]), HOJE)
    expect(opcoes[0]).toMatchObject({ situacao: "FORA_DA_REGRA", motivo: "Sem integração válida" })
  })
})
