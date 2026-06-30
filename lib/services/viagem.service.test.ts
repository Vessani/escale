import { describe, it, expect, vi, beforeEach } from "vitest";
import { criarViagemService, editarViagemService } from "./viagem.service";
import { prisma } from "@/lib/prisma";
import { NovaViagemInput, EditarViagemInput } from "@/lib/types/types";
import { Motorista, Viagem } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    motorista: { findMany: vi.fn() },
    viagem: { create: vi.fn(), update: vi.fn() },
  },
}));

describe("Viagem Service - Sistema Híbrido de Alocação", () => {
  beforeEach(() => {
    vi.clearAllMocks(); 
  });

  it("Cenário 1: Deve alocar automaticamente o motorista com maior disponibilidade", async () => {
    const dadosViagem: NovaViagemInput = {
      numViagem: "1001",
      carreta: "ABC1D23",
      cavalo: "XYZ9K88",
      tanque: "100%",
      diasViagem: 2,
      inicioPrevisto: new Date("2026-06-25T06:00:00Z"),
      fimPrevisto: new Date("2026-06-27T18:00:00Z"),
      turno: "MANHA",
      entregas: [], 
    };

    vi.mocked(prisma.motorista.findMany).mockResolvedValue([
      {
        id: 1,
        nome: "João",
        turno: "MANHA",
        diasTrabalhados: 4,
        integracao: [],
      },
      {
        id: 2,
        nome: "Carlos",
        turno: "MANHA",
        diasTrabalhados: 1,
        integracao: [],
      },
    ] as unknown as Motorista[]);

    vi.mocked(prisma.viagem.create).mockResolvedValue({ 
      id: 99 
    } as unknown as Viagem);

    await criarViagemService(dadosViagem);

    expect(prisma.viagem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ motoristaId: 2, status: "ALOCADA" }),
      })
    );
  });

  it("Cenário 2: Deve manter sem motorista quando nenhum tiver dias disponíveis suficientes", async () => {
    const dadosViagem: NovaViagemInput = {
      numViagem: "1002",
      carreta: "DEF4G56",
      cavalo: "LMN1O22",
      tanque: "80%",
      diasViagem: 3,
      inicioPrevisto: new Date("2026-06-28T18:00:00Z"),
      fimPrevisto: new Date("2026-06-29T06:00:00Z"),
      turno: "NOITE",
      entregas: [],
    };

    vi.mocked(prisma.motorista.findMany).mockResolvedValue([
      {
        id: 10,
        nome: "Noite 1",
        turno: "NOITE",
        diasTrabalhados: 5,
        integracao: [],
      },
    ] as unknown as Motorista[]);
    
    vi.mocked(prisma.viagem.create).mockResolvedValue({ 
      id: 100 
    } as unknown as Viagem);

    await criarViagemService(dadosViagem);

    expect(prisma.viagem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ motoristaId: null, status: "CRIADA" }),
      })
    );
  });

  it("Cenário 3: Deve permitir que o despachante force um motorista manualmente na edição", async () => {
    const dadosEditar: EditarViagemInput = {
      numViagem: "1002",
      carreta: "DEF4G56",
      cavalo: "LMN1O22",
      tanque: "80%",
      diasViagem: 1,
      inicioPrevisto: new Date("2026-06-28T18:00:00Z"),
      fimPrevisto: new Date("2026-06-29T06:00:00Z"),
      turno: "NOITE",
      entregas: [],
      motoristaId: 5, 
    };

    vi.mocked(prisma.viagem.update).mockResolvedValue({ 
      id: 100 
    } as unknown as Viagem);

    await editarViagemService(100, dadosEditar);

    expect(prisma.viagem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ motoristaId: 5 }),
      })
    );
  });
});