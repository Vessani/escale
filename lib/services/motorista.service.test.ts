import { describe, it, expect, vi, beforeEach } from "vitest";
import { criarMotoristaService, editarMotoristaService, deletarMotoristaService } from "./motorista.service";
import { prisma } from "@/lib/prisma";
import { NovoMotoristaInput, EditarMotoristaInput } from "@/lib/types/types";
import { Motorista } from "@prisma/client";

// Criamos o simulador do Prisma focado apenas na entidade motorista
vi.mock("@/lib/prisma", () => ({
  prisma: {
    motorista: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Motorista Service - Testes de Unidade", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Limpa o histórico de simulações antes de cada teste
  });

  // ==========================================
  // TESTE 1: CRIAÇÃO DE MOTORISTA
  // ==========================================
  it("Deve criar um motorista converte as datas e inclui as integrações corretamente", async () => {
    const dadosNovoMotorista: NovoMotoristaInput = {
      nome: "Carlos Santos",
      seva: 98765,
      diasTrabalhados: 5,
      turno: "MANHA",
      integracao: [
        {
          dataValidade: "2026-12-31", // Enviado como string pelo front-end
          cliente: "Ambev",
          status: "ATIVO",
        },
      ],
    };

    // Truque Sênior: Evitamos o 'any' usando o 'as unknown as Motorista'
    vi.mocked(prisma.motorista.create).mockResolvedValue({ id: 1 } as unknown as Motorista);

    const resultado = await criarMotoristaService(dadosNovoMotorista);

    // Verifica se o Prisma recebeu o comando com os dados certos e a data convertida em objeto Date
    expect(prisma.motorista.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: "Carlos Santos",
          turno: "MANHA",
          integracao: {
            create: [
              {
                dataValidade: new Date("2026-12-31"),
                cliente: "Ambev",
                status: "ATIVO",
              },
            ],
          },
        }),
      })
    );
    expect(resultado).toBeDefined();
  });

  // ==========================================
  // TESTE 2: EDIÇÃO COMPLEXA (O Coração do Service)
  // ==========================================
  it("Deve separar integrações novas de existentes e aplicar o deleteMany corretamente na edição", async () => {
    const dadosEdicao: EditarMotoristaInput = {
      nome: "Carlos Silva", // Nome alterado
      seva: 98765,
      diasTrabalhados: 6,
      turno: "MANHA",
      integracao: [
        // 1. Uma integração que já existia no banco (tem ID)
        {
          id: 45,
          dataValidade: "2026-12-31",
          cliente: "Ambev",
          status: "ATIVO",
        },
        // 2. Uma integração nova adicionada na tela (não tem ID)
        {
          dataValidade: "2027-06-15",
          cliente: "Klabin",
          status: "ATIVO",
        },
      ],
    };

    vi.mocked(prisma.motorista.update).mockResolvedValue({ id: 1 } as unknown as Motorista);

    await editarMotoristaService(1, dadosEdicao);

    // Testamos se a lógica complexa de sincronização do Prisma foi montada certa
    expect(prisma.motorista.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          nome: "Carlos Silva",
          integracao: {
            // Garante que o sistema mandou apagar todas as integrações EXCETO a de ID 45
            deleteMany: {
              id: { notIn: [45] },
            },
            // Garante que atualizou a antiga (ID 45)
            update: [
              {
                where: { id: 45 },
                data: {
                  dataValidade: new Date("2026-12-31"),
                  cliente: "Ambev",
                  status: "ATIVO",
                },
              },
            ],
            // Garante que criou a nova (Klabin)
            create: [
              {
                dataValidade: new Date("2027-06-15"),
                cliente: "Klabin",
                status: "ATIVO",
              },
            ],
          },
        }),
      })
    );
  });

  // ==========================================
  // TESTE 3: EXCLUSÃO LOGICAL (Soft Delete)
  // ==========================================
  it("Deve aplicar o Soft Delete atualizando apenas a coluna deletadoEm", async () => {
    vi.mocked(prisma.motorista.update).mockResolvedValue({ id: 1 } as unknown as Motorista);

    await deletarMotoristaService(1);

    // Garante que o deletar não remove a linha, mas sim faz um UPDATE colocando a data atual
    expect(prisma.motorista.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        deletadoEm: expect.any(Date), // Valida que uma data qualquer foi gerada ali
      },
    });
  });
});