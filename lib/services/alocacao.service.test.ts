import { describe, expect, it } from "vitest"
import type { StatusIntegracao, Turno } from "@prisma/client"
import {
  calcularDiasDisponiveis,
  calcularIntegracaoExigida,
  filtrarMotoristasCompativeis,
  filtrarMotoristasDisponiveisNoPeriodo,
  motoristaEhCompativel,
  motoristaEstaDisponivelNoPeriodo,
  periodoConflita,
  periodosConflitamComDescanso,
  sugerirAlocacoesEmLote,
  sugerirMotoristaAutomatico,
} from "@/lib/services/alocacao.service"

type MotoristaMock = {
  id: number
  nome: string
  turno: Turno
  diasTrabalhados: number
  integracao: Array<{ cliente: string; status: StatusIntegracao; dataValidade: Date }>
  registrosJornada: Array<{ data: Date; codigo: number }>
}

function criarMotorista(parcial: Partial<MotoristaMock>): MotoristaMock {
  return {
    id: 1,
    nome: "Motorista Teste",
    turno: "MANHA",
    diasTrabalhados: 3,
    integracao: [],
    registrosJornada: [],
    ...parcial,
  }
}

describe("alocacao.service", () => {
  describe("calcularDiasDisponiveis", () => {
    it("subtrai o dia atual de 6 para códigos de trabalho (1-6)", () => {
      expect(calcularDiasDisponiveis(1)).toBe(5)
      expect(calcularDiasDisponiveis(3)).toBe(3)
      expect(calcularDiasDisponiveis(6)).toBe(0)
    })

    it("bloqueia (0 disponíveis) em Folga, Férias, Exames e Interno", () => {
      expect(calcularDiasDisponiveis(7)).toBe(0)
      expect(calcularDiasDisponiveis(8)).toBe(0)
      expect(calcularDiasDisponiveis(9)).toBe(0)
      expect(calcularDiasDisponiveis(10)).toBe(0)
    })

    it("bloqueia códigos inválidos (0 ou negativos)", () => {
      expect(calcularDiasDisponiveis(0)).toBe(0)
      expect(calcularDiasDisponiveis(-3)).toBe(0)
    })
  })

  describe("calcularIntegracaoExigida", () => {
    it("retorna null quando nenhum cliente exige integração", () => {
      expect(calcularIntegracaoExigida([{ cliente: "Cliente Comum" }, { cliente: "Outro" }])).toBeNull()
    })

    it("detecta o cliente do grupo AMBEV e a WEG normalizando maiúsculas/espaços", () => {
      expect(calcularIntegracaoExigida([{ cliente: "  gemp - ambev - bebidas - n2l. (grupo amb  " }])).toBe(
        "GEMP - AMBEV - BEBIDAS - N2L. (GRUPO AMB",
      )
      expect(calcularIntegracaoExigida([{ cliente: "weg" }])).toBe("WEG")
    })

    it("retorna o primeiro cliente da lista que exige integração", () => {
      const resultado = calcularIntegracaoExigida([
        { cliente: "Cliente Comum" },
        { cliente: "weg" },
        { cliente: "ambev" },
      ])
      expect(resultado).toBe("WEG")
    })
  })

  describe("motoristaEhCompativel", () => {
    const hoje = new Date("2026-07-08T00:00:00")

    it("nega quando o turno do motorista diverge do turno da viagem", () => {
      const motorista = criarMotorista({ turno: "NOITE", diasTrabalhados: 1 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(false)
    })

    it("aceita quando os dias disponíveis no dia da viagem cobrem a duração pedida", () => {
      const motorista = criarMotorista({ diasTrabalhados: 3 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 3,
          dataInicioViagem: hoje,
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(true)
    })

    it("nega quando a viagem dura mais dias do que o motorista tem disponível", () => {
      const motorista = criarMotorista({ diasTrabalhados: 3 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 4,
          dataInicioViagem: hoje,
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(false)
    })

    it("bloqueia uma viagem que começaria no próprio dia de Folga do motorista", () => {
      const motorista = criarMotorista({ diasTrabalhados: 7 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(false)
    })

    it("libera o motorista no dia seguinte à Folga (ciclo reinicia em 1)", () => {
      const motorista = criarMotorista({ diasTrabalhados: 7 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 5,
          dataInicioViagem: new Date("2026-07-09T00:00:00"),
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(true)
    })

    it("projeta a jornada pela data real de início da viagem, não pelo dia de hoje", () => {
      // Hoje ele está no dia 3 (parece disponível), mas a viagem só começa daqui
      // a 4 dias — quando, pela rotação, ele já estaria de folga.
      const motorista = criarMotorista({ diasTrabalhados: 3 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: new Date("2026-07-12T00:00:00"),
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(false)
    })

    it("libera motorista sem dias hoje quando a viagem começa depois do reset do ciclo", () => {
      // Hoje ele está no dia 6 (0 disponíveis agora), mas a viagem só começa
      // daqui a 2 dias, quando o ciclo já reseta pro dia 1.
      const motorista = criarMotorista({ diasTrabalhados: 6 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: new Date("2026-07-10T00:00:00"),
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(true)
    })

    it("respeita um registro manual futuro (ex: Férias) na data em que ele existe, e libera depois de um registro que encerra o período", () => {
      const motorista = criarMotorista({
        diasTrabalhados: 3,
        registrosJornada: [
          { data: hoje, codigo: 3 },
          { data: new Date("2026-07-11T00:00:00"), codigo: 8 }, // Férias marcada manualmente
          { data: new Date("2026-07-20T00:00:00"), codigo: 1 }, // volta ao trabalho
        ],
      })

      const contextoBase = { turnoViagem: "MANHA" as Turno, diasViagem: 1, integracaoExigida: null, hoje }

      expect(
        motoristaEhCompativel(motorista, { ...contextoBase, dataInicioViagem: new Date("2026-07-11T00:00:00") }),
      ).toBe(false) // no meio das férias
      expect(
        motoristaEhCompativel(motorista, { ...contextoBase, dataInicioViagem: new Date("2026-07-15T00:00:00") }),
      ).toBe(false) // férias não rotacionam sozinhas, continua bloqueado
      expect(
        motoristaEhCompativel(motorista, { ...contextoBase, dataInicioViagem: new Date("2026-07-20T00:00:00") }),
      ).toBe(true) // registro explícito de volta ao trabalho
    })

    it("libera quando a viagem não exige integração", () => {
      const motorista = criarMotorista({ diasTrabalhados: 1 })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: null,
          hoje,
        }),
      ).toBe(true)
    })

    it("nega quando a viagem exige integração e o motorista não tem nenhuma para o cliente", () => {
      const motorista = criarMotorista({ diasTrabalhados: 1, integracao: [] })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: "AMBEV",
          hoje,
        }),
      ).toBe(false)
    })

    it("nega quando a integração existe mas está INATIVA", () => {
      const motorista = criarMotorista({
        diasTrabalhados: 1,
        integracao: [{ cliente: "AMBEV", status: "INATIVO", dataValidade: new Date("2027-01-01") }],
      })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: "AMBEV",
          hoje,
        }),
      ).toBe(false)
    })

    it("nega quando a integração ATIVA já venceu antes do início da viagem", () => {
      const motorista = criarMotorista({
        diasTrabalhados: 1,
        integracao: [{ cliente: "AMBEV", status: "ATIVO", dataValidade: new Date("2026-07-01") }],
      })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: "AMBEV",
          hoje,
        }),
      ).toBe(false)
    })

    it("aceita quando a integração está ATIVA e válida na data de início (mesmo com grafia diferente)", () => {
      const motorista = criarMotorista({
        diasTrabalhados: 1,
        integracao: [{ cliente: "ambev", status: "ATIVO", dataValidade: new Date("2027-01-01") }],
      })
      expect(
        motoristaEhCompativel(motorista, {
          turnoViagem: "MANHA",
          diasViagem: 1,
          dataInicioViagem: hoje,
          integracaoExigida: "AMBEV",
          hoje,
        }),
      ).toBe(true)
    })
  })

  describe("filtrarMotoristasCompativeis", () => {
    const hoje = new Date("2026-07-08T00:00:00")
    const contexto = {
      turnoViagem: "MANHA" as Turno,
      diasViagem: 1,
      dataInicioViagem: hoje,
      integracaoExigida: null,
      hoje,
    }

    it("remove os incompatíveis e ordena os demais por dias disponíveis (mais livre primeiro)", () => {
      const ocupado = criarMotorista({ id: 1, nome: "Carlos", diasTrabalhados: 5 }) // 1 disponível
      const livre = criarMotorista({ id: 2, nome: "Ana", diasTrabalhados: 1 }) // 5 disponíveis
      const foraDeTurno = criarMotorista({ id: 3, nome: "Bruno", turno: "NOITE", diasTrabalhados: 1 })

      const resultado = filtrarMotoristasCompativeis([ocupado, livre, foraDeTurno], contexto)

      expect(resultado.map((m) => m.id)).toEqual([2, 1])
    })

    it("em empate de disponibilidade, desempata por nome em ordem alfabética", () => {
      const zeca = criarMotorista({ id: 1, nome: "Zeca", diasTrabalhados: 1 })
      const ana = criarMotorista({ id: 2, nome: "Ana", diasTrabalhados: 1 })

      const resultado = filtrarMotoristasCompativeis([zeca, ana], contexto)

      expect(resultado.map((m) => m.nome)).toEqual(["Ana", "Zeca"])
    })
  })

  describe("periodoConflita", () => {
    it("detecta sobreposição real de horário", () => {
      expect(
        periodoConflita(
          new Date("2026-07-10T08:00:00"),
          new Date("2026-07-10T12:00:00"),
          new Date("2026-07-10T10:00:00"),
          new Date("2026-07-10T14:00:00"),
        ),
      ).toBe(true)
    })

    it("não considera conflito quando os períodos só se tocam na borda", () => {
      expect(
        periodoConflita(
          new Date("2026-07-10T08:00:00"),
          new Date("2026-07-10T12:00:00"),
          new Date("2026-07-10T12:00:00"),
          new Date("2026-07-10T14:00:00"),
        ),
      ).toBe(false)
    })

    it("não considera conflito quando os períodos são totalmente separados", () => {
      expect(
        periodoConflita(
          new Date("2026-07-10T08:00:00"),
          new Date("2026-07-10T09:00:00"),
          new Date("2026-07-11T08:00:00"),
          new Date("2026-07-11T09:00:00"),
        ),
      ).toBe(false)
    })
  })

  describe("periodosConflitamComDescanso", () => {
    it("exige 1 dia calendário completo de descanso após o fim de uma viagem", () => {
      // Termina dia 9 às 03h; a próxima começa dia 9 às 09h — mesmo sem
      // sobrepor o horário exato, ainda é o mesmo dia calendário.
      expect(
        periodosConflitamComDescanso(
          new Date("2026-07-08T08:00:00"),
          new Date("2026-07-09T03:00:00"),
          new Date("2026-07-09T09:00:00"),
          new Date("2026-07-10T03:00:00"),
        ),
      ).toBe(true)
    })

    it("libera a partir do primeiro dia calendário seguinte ao fim da viagem anterior", () => {
      expect(
        periodosConflitamComDescanso(
          new Date("2026-07-08T08:00:00"),
          new Date("2026-07-09T03:00:00"),
          new Date("2026-07-10T05:00:00"),
          new Date("2026-07-10T20:00:00"),
        ),
      ).toBe(false)
    })
  })

  describe("motoristaEstaDisponivelNoPeriodo", () => {
    const inicioNovaViagem = new Date("2026-07-10T09:00:00")
    const fimNovaViagem = new Date("2026-07-11T09:00:00")

    it("fica indisponível se já tem viagem ativa sobreposta (considerando o dia de descanso)", () => {
      const motorista = {
        ...criarMotorista({}),
        viagens: [
          {
            id: 1,
            inicioPrevisto: new Date("2026-07-10T08:00:00"),
            fimPrevisto: new Date("2026-07-10T12:00:00"),
            status: "ALOCADA" as const,
            deletadoEm: null,
          },
        ],
      }

      expect(motoristaEstaDisponivelNoPeriodo(motorista, inicioNovaViagem, fimNovaViagem)).toBe(false)
    })

    it("ignora viagens CANCELADA e FINALIZADA ao calcular disponibilidade", () => {
      const motorista = {
        ...criarMotorista({}),
        viagens: [
          {
            id: 1,
            inicioPrevisto: new Date("2026-07-10T08:00:00"),
            fimPrevisto: new Date("2026-07-10T12:00:00"),
            status: "CANCELADA" as const,
            deletadoEm: null,
          },
          {
            id: 2,
            inicioPrevisto: new Date("2026-07-10T08:00:00"),
            fimPrevisto: new Date("2026-07-10T12:00:00"),
            status: "FINALIZADA" as const,
            deletadoEm: null,
          },
        ],
      }

      expect(motoristaEstaDisponivelNoPeriodo(motorista, inicioNovaViagem, fimNovaViagem)).toBe(true)
    })

    it("ignora viagens com deletadoEm preenchido (soft delete)", () => {
      const motorista = {
        ...criarMotorista({}),
        viagens: [
          {
            id: 1,
            inicioPrevisto: new Date("2026-07-10T08:00:00"),
            fimPrevisto: new Date("2026-07-10T12:00:00"),
            status: "ALOCADA" as const,
            deletadoEm: new Date("2026-07-01T00:00:00"),
          },
        ],
      }

      expect(motoristaEstaDisponivelNoPeriodo(motorista, inicioNovaViagem, fimNovaViagem)).toBe(true)
    })
  })

  describe("filtrarMotoristasDisponiveisNoPeriodo", () => {
    it("mantém apenas quem não tem conflito de agenda no período", () => {
      const inicioNovaViagem = new Date("2026-07-10T09:00:00")
      const fimNovaViagem = new Date("2026-07-11T09:00:00")

      const ocupado = {
        ...criarMotorista({ id: 1, nome: "Ocupado" }),
        viagens: [
          {
            id: 1,
            inicioPrevisto: new Date("2026-07-10T08:00:00"),
            fimPrevisto: new Date("2026-07-10T12:00:00"),
            status: "ALOCADA" as const,
            deletadoEm: null,
          },
        ],
      }
      const livre = {
        ...criarMotorista({ id: 2, nome: "Livre" }),
        viagens: [],
      }

      const resultado = filtrarMotoristasDisponiveisNoPeriodo([ocupado, livre], inicioNovaViagem, fimNovaViagem)

      expect(resultado.map((m) => m.nome)).toEqual(["Livre"])
    })
  })

  describe("sugerirMotoristaAutomatico", () => {
    const hoje = new Date("2026-07-08T00:00:00")

    const fimViagem = new Date("2026-07-08T23:59:00")

    it("retorna null quando ninguém é compatível", () => {
      const motorista = { ...criarMotorista({ turno: "NOITE" }), viagens: [] }
      const resultado = sugerirMotoristaAutomatico([motorista], fimViagem, {
        turnoViagem: "MANHA",
        diasViagem: 1,
        dataInicioViagem: hoje,
        integracaoExigida: null,
        hoje,
      })

      expect(resultado).toBeNull()
    })

    it("retorna o motorista mais disponível entre os compatíveis", () => {
      const menosDisponivel = { ...criarMotorista({ id: 1, nome: "Carlos", diasTrabalhados: 5 }), viagens: [] }
      const maisDisponivel = { ...criarMotorista({ id: 2, nome: "Ana", diasTrabalhados: 1 }), viagens: [] }

      const resultado = sugerirMotoristaAutomatico([menosDisponivel, maisDisponivel], fimViagem, {
        turnoViagem: "MANHA",
        diasViagem: 1,
        dataInicioViagem: hoje,
        integracaoExigida: null,
        hoje,
      })

      expect(resultado?.id).toBe(2)
    })
  })

  describe("sugerirAlocacoesEmLote", () => {
    function comAgenda(parcial: Partial<MotoristaMock>) {
      return { ...criarMotorista(parcial), viagens: [] }
    }

    it("não repete o mesmo motorista em duas viagens do lote com período sobreposto", () => {
      const maisDisponivel = comAgenda({ id: 1, nome: "Ana", diasTrabalhados: 1 }) // 5 disponíveis
      const menosDisponivel = comAgenda({ id: 2, nome: "Bruno", diasTrabalhados: 3 }) // 3 disponíveis
      const hoje = new Date("2026-07-04T00:00:00")

      const viagens = [
        {
          id: 10,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-04T08:00:00"),
          fimPrevisto: new Date("2026-07-06T08:00:00"),
          integracaoExigida: null,
        },
        {
          id: 11,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-05T08:00:00"), // sobrepõe a viagem 10
          fimPrevisto: new Date("2026-07-07T08:00:00"),
          integracaoExigida: null,
        },
      ]

      const resultado = sugerirAlocacoesEmLote(viagens, [maisDisponivel, menosDisponivel], hoje)

      expect(resultado[0].motoristaSugerido?.id).toBe(1)
      expect(resultado[1].motoristaSugerido?.id).toBe(2)
    })

    it("permite reaproveitar o mesmo motorista quando as viagens do lote não se sobrepõem", () => {
      const motorista = comAgenda({ id: 1, nome: "Ana", diasTrabalhados: 1 })
      const hoje = new Date("2026-07-03T00:00:00")

      const viagens = [
        {
          id: 10,
          turno: "MANHA" as Turno,
          diasViagem: 1,
          inicioPrevisto: new Date("2026-07-04T08:00:00"),
          fimPrevisto: new Date("2026-07-04T20:00:00"),
          integracaoExigida: null,
        },
        {
          id: 11,
          turno: "MANHA" as Turno,
          diasViagem: 1,
          inicioPrevisto: new Date("2026-07-10T08:00:00"),
          fimPrevisto: new Date("2026-07-10T20:00:00"),
          integracaoExigida: null,
        },
      ]

      const resultado = sugerirAlocacoesEmLote(viagens, [motorista], hoje)

      expect(resultado[0].motoristaSugerido?.id).toBe(1)
      expect(resultado[1].motoristaSugerido?.id).toBe(1)
    })

    it("retorna null e lista vazia quando o único compatível já foi usado numa viagem sobreposta", () => {
      const unico = comAgenda({ id: 1, nome: "Ana", diasTrabalhados: 1 })
      const hoje = new Date("2026-07-04T00:00:00")

      const viagens = [
        {
          id: 10,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-04T08:00:00"),
          fimPrevisto: new Date("2026-07-06T08:00:00"),
          integracaoExigida: null,
        },
        {
          id: 11,
          turno: "MANHA" as Turno,
          diasViagem: 2,
          inicioPrevisto: new Date("2026-07-05T08:00:00"),
          fimPrevisto: new Date("2026-07-07T08:00:00"),
          integracaoExigida: null,
        },
      ]

      const resultado = sugerirAlocacoesEmLote(viagens, [unico], hoje)

      expect(resultado[0].motoristaSugerido?.id).toBe(1)
      expect(resultado[1].motoristaSugerido).toBeNull()
      expect(resultado[1].motoristasCompativeis).toEqual([])
    })
  })
})
