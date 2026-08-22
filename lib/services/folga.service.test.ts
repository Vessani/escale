import { describe, expect, it, vi } from "vitest"
import {
  deveMarcarMotoristaComoFolga,
  deveRetirarMotoristaDaFolga,
  reconciliarFolgaMotoristasNoDiaAtual,
} from "@/lib/services/folga.service"

function criarTx() {
  return {
    motorista: { findMany: vi.fn(), update: vi.fn() },
    registroJornada: { upsert: vi.fn() },
  }
}

/** Diferencia as duas queries que a função faz: `diasTrabalhados` é um número (7) pra quem está saindo da folga, ou um range ({gte,lte}) pra quem pode entrar em folga. */
function mockFindMany(
  tx: ReturnType<typeof criarTx>,
  respostas: { paraFolga?: Array<{ id: number }>; saindoDaFolga?: Array<{ id: number }> },
) {
  vi.mocked(tx.motorista.findMany).mockImplementation((args: never) => {
    const condicao = (args as { where: { diasTrabalhados: unknown } }).where.diasTrabalhados
    return Promise.resolve(typeof condicao === "number" ? respostas.saindoDaFolga ?? [] : respostas.paraFolga ?? [])
  })
}

type ViagemFake = { deletadoEm: Date | null; status: string; inicioPrevisto: Date; fimPrevisto: Date }
type MotoristaFake = {
  id: number
  deletadoEm: Date | null
  diasTrabalhados: number
  viagens: ViagemFake[]
  /** Viagens onde ele é acompanhante — também contam como atividade hoje (ver folga.service.ts). */
  viagensComoAcompanhante?: ViagemFake[]
}
type FiltroViagem = { status: { notIn: string[] }; inicioPrevisto: { lte: Date }; fimPrevisto: { gte: Date } }

/**
 * Fake fiel só à query usada por `reconciliarFolgaMotoristasNoDiaAtual`: avalia
 * de verdade a janela de datas (`inicioPrevisto <= fimJanela && fimPrevisto >=
 * inicioJanela`) contra os dados em memória, em vez de decidir a resposta na
 * mão — assim o teste pega de verdade um erro na conta da janela "hoje".
 * Considera atividade tanto em `viagens` (principal) quanto `viagensComoAcompanhante`.
 */
function criarFindManyFielAJanela(motoristas: MotoristaFake[]) {
  return vi.fn((args: {
    where: {
      id: { in: number[] }
      diasTrabalhados: number | { gte: number; lte: number }
      AND?: Array<{ viagens?: { none: FiltroViagem }; viagensComoAcompanhante?: { none: FiltroViagem } }>
      OR?: Array<{ viagens?: { some: FiltroViagem }; viagensComoAcompanhante?: { some: FiltroViagem } }>
    }
  }) => {
    const { where } = args
    const exigeAtividade = Boolean(where.OR)
    const condicaoViagens = exigeAtividade ? where.OR![0].viagens!.some : where.AND![0].viagens!.none

    const temViagemNaJanela = (m: MotoristaFake) =>
      [...m.viagens, ...(m.viagensComoAcompanhante ?? [])].some(
        (v) =>
          v.deletadoEm === null &&
          !condicaoViagens.status.notIn.includes(v.status) &&
          v.inicioPrevisto.getTime() <= condicaoViagens.inicioPrevisto.lte.getTime() &&
          v.fimPrevisto.getTime() >= condicaoViagens.fimPrevisto.gte.getTime(),
      )

    const resultado = motoristas.filter((m) => {
      const diasOk =
        typeof where.diasTrabalhados === "number"
          ? m.diasTrabalhados === where.diasTrabalhados
          : m.diasTrabalhados >= where.diasTrabalhados.gte && m.diasTrabalhados <= where.diasTrabalhados.lte

      return (
        where.id.in.includes(m.id) &&
        m.deletadoEm === null &&
        diasOk &&
        (exigeAtividade ? temViagemNaJanela(m) : !temViagemNaJanela(m))
      )
    })

    return Promise.resolve(resultado.map((m) => ({ id: m.id })))
  })
}

describe("folga.service", () => {
  describe("deveMarcarMotoristaComoFolga", () => {
    it("marca folga para qualquer dia de 1 a 6 sem viagem ativa hoje", () => {
      for (let dia = 1; dia <= 6; dia++) {
        expect(deveMarcarMotoristaComoFolga(dia, false)).toBe(true)
      }
    })

    it("não marca folga se já existe viagem ativa hoje", () => {
      for (let dia = 1; dia <= 6; dia++) {
        expect(deveMarcarMotoristaComoFolga(dia, true)).toBe(false)
      }
    })

    it("não marca folga para quem já está em Folga/Férias/Exames/Interno", () => {
      expect(deveMarcarMotoristaComoFolga(7, false)).toBe(false)
      expect(deveMarcarMotoristaComoFolga(8, false)).toBe(false)
      expect(deveMarcarMotoristaComoFolga(9, false)).toBe(false)
      expect(deveMarcarMotoristaComoFolga(10, false)).toBe(false)
    })

    it("não marca folga para código fora da faixa válida", () => {
      expect(deveMarcarMotoristaComoFolga(0, false)).toBe(false)
      expect(deveMarcarMotoristaComoFolga(-1, false)).toBe(false)
    })
  })

  describe("deveRetirarMotoristaDaFolga", () => {
    it("retira da folga quando está em Folga (7) e surge uma viagem ativa hoje", () => {
      expect(deveRetirarMotoristaDaFolga(7, true)).toBe(true)
    })

    it("mantém em folga quando está em Folga (7) mas não há viagem ativa hoje", () => {
      expect(deveRetirarMotoristaDaFolga(7, false)).toBe(false)
    })

    it("não se aplica a quem não está em Folga (7), mesmo com viagem ativa", () => {
      expect(deveRetirarMotoristaDaFolga(1, true)).toBe(false)
      expect(deveRetirarMotoristaDaFolga(6, true)).toBe(false)
      expect(deveRetirarMotoristaDaFolga(8, true)).toBe(false)
    })
  })

  describe("reconciliarFolgaMotoristasNoDiaAtual", () => {
    it("tira o motorista da folga quando uma viagem é criada pra ele hoje", async () => {
      const tx = criarTx()
      mockFindMany(tx, { saindoDaFolga: [{ id: 5 }] })
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})

      const agora = new Date()
      await reconciliarFolgaMotoristasNoDiaAtual(tx as never, [5], [{ inicioPrevisto: agora, fimPrevisto: agora }], agora)

      expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
      const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as {
        where: { motoristaId_data: { motoristaId: number } }
        create: { codigo: number }
      }
      expect(upsertArgs.where.motoristaId_data.motoristaId).toBe(5)
      expect(upsertArgs.create.codigo).toBe(1)
      expect(tx.motorista.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { diasTrabalhados: 1 } })
    })

    it("marca folga quando o motorista deixa de ter viagem ativa hoje (ex: viagem cancelada/apagada)", async () => {
      const tx = criarTx()
      mockFindMany(tx, { paraFolga: [{ id: 8 }] })
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})

      const agora = new Date()
      await reconciliarFolgaMotoristasNoDiaAtual(tx as never, [8], [{ inicioPrevisto: agora, fimPrevisto: agora }], agora)

      const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { create: { codigo: number } }
      expect(upsertArgs.create.codigo).toBe(7)
      expect(tx.motorista.update).toHaveBeenCalledWith({ where: { id: 8 }, data: { diasTrabalhados: 7 } })
    })

    it("não consulta o banco quando nenhum id relevante é informado", async () => {
      const tx = criarTx()

      await reconciliarFolgaMotoristasNoDiaAtual(tx as never, [null, undefined], [])

      expect(tx.motorista.findMany).not.toHaveBeenCalled()
    })

    it("remove ids duplicados antes de consultar o banco", async () => {
      const tx = criarTx()
      mockFindMany(tx, {})

      const agora = new Date()
      await reconciliarFolgaMotoristasNoDiaAtual(tx as never, [5, 5, null], [{ inicioPrevisto: agora, fimPrevisto: agora }], agora)

      const primeiraChamada = vi.mocked(tx.motorista.findMany).mock.calls[0][0] as { where: { id: { in: number[] } } }
      expect(primeiraChamada.where.id.in).toEqual([5])
    })

    it("viagem agendada só pra amanhã não tira o motorista da folga hoje", async () => {
      const hoje = new Date("2026-07-10T12:00:00")
      const motoristas: MotoristaFake[] = [
        {
          id: 5,
          deletadoEm: null,
          diasTrabalhados: 7,
          viagens: [
            {
              deletadoEm: null,
              status: "ALOCADA",
              inicioPrevisto: new Date("2026-07-11T08:00:00"),
              fimPrevisto: new Date("2026-07-11T20:00:00"),
            },
          ],
        },
      ]

      const tx = criarTx()
      tx.motorista.findMany = criarFindManyFielAJanela(motoristas) as never
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})

      // A janela relevante é a da viagem que disparou a chamada (amanhã) — não toca hoje.
      await reconciliarFolgaMotoristasNoDiaAtual(
        tx as never,
        [5],
        [{ inicioPrevisto: new Date("2026-07-11T08:00:00"), fimPrevisto: new Date("2026-07-11T20:00:00") }],
        hoje,
      )

      expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      expect(tx.motorista.update).not.toHaveBeenCalled()
      // Nem chega a consultar o banco — a janela já descarta antes da query
      // (é justamente essa checagem que faltava: criar/editar uma viagem
      // futura não deveria mexer no status de folga de hoje).
      expect(tx.motorista.findMany).not.toHaveBeenCalled()
    })

    it("criar uma viagem futura pra um motorista SEM nenhuma outra viagem hoje não marca ele como 'de folga hoje' — bug encontrado numa simulação de 30 dias", async () => {
      const hoje = new Date("2026-07-10T12:00:00")
      const tx = criarTx()
      mockFindMany(tx, { paraFolga: [{ id: 9 }] }) // se a query rodasse, encontraria o motorista "sem atividade hoje" (não tem viagem nenhuma).

      // A viagem que disparou a chamada é daqui a 4 dias — não toca hoje.
      await reconciliarFolgaMotoristasNoDiaAtual(
        tx as never,
        [9],
        [{ inicioPrevisto: new Date("2026-07-14T08:00:00"), fimPrevisto: new Date("2026-07-14T20:00:00") }],
        hoje,
      )

      expect(tx.motorista.findMany).not.toHaveBeenCalled()
      expect(tx.registroJornada.upsert).not.toHaveBeenCalled()
      expect(tx.motorista.update).not.toHaveBeenCalled()
    })

    it("tira o motorista da folga quando ele tem atividade hoje só como acompanhante (não como principal)", async () => {
      const hoje = new Date("2026-07-10T12:00:00")
      const motoristas: MotoristaFake[] = [
        {
          id: 5,
          deletadoEm: null,
          diasTrabalhados: 7,
          viagens: [],
          viagensComoAcompanhante: [
            {
              deletadoEm: null,
              status: "ALOCADA",
              inicioPrevisto: new Date("2026-07-10T08:00:00"),
              fimPrevisto: new Date("2026-07-10T20:00:00"),
            },
          ],
        },
      ]

      const tx = criarTx()
      tx.motorista.findMany = criarFindManyFielAJanela(motoristas) as never
      vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})

      await reconciliarFolgaMotoristasNoDiaAtual(
        tx as never,
        [5],
        [{ inicioPrevisto: new Date("2026-07-10T08:00:00"), fimPrevisto: new Date("2026-07-10T20:00:00") }],
        hoje,
      )

      expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
      const upsertArgs = vi.mocked(tx.registroJornada.upsert).mock.calls[0][0] as { create: { codigo: number } }
      expect(upsertArgs.create.codigo).toBe(1)
    })

    it("mas tira o motorista da folga quando a reconciliação roda no próprio dia da viagem", async () => {
      // registrarJornadaNoDia só atualiza o cache diasTrabalhados quando o dia
      // registrado é "hoje" de verdade (new Date() interno) — por isso fixamos
      // o relógio no dia da viagem, simulando a reconciliação rodando nesse dia.
      const diaDaViagem = new Date("2026-07-11T09:00:00")
      vi.useFakeTimers()
      vi.setSystemTime(diaDaViagem)

      try {
        const motoristas: MotoristaFake[] = [
          {
            id: 5,
            deletadoEm: null,
            diasTrabalhados: 7,
            viagens: [
              {
                deletadoEm: null,
                status: "ALOCADA",
                inicioPrevisto: new Date("2026-07-11T08:00:00"),
                fimPrevisto: new Date("2026-07-11T20:00:00"),
              },
            ],
          },
        ]

        const tx = criarTx()
        tx.motorista.findMany = criarFindManyFielAJanela(motoristas) as never
        vi.mocked(tx.registroJornada.upsert).mockResolvedValue({})

        await reconciliarFolgaMotoristasNoDiaAtual(
          tx as never,
          [5],
          [{ inicioPrevisto: new Date("2026-07-11T08:00:00"), fimPrevisto: new Date("2026-07-11T20:00:00") }],
        )

        expect(tx.registroJornada.upsert).toHaveBeenCalledTimes(1)
        expect(tx.motorista.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { diasTrabalhados: 1 } })
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
