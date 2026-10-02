import type { StatusIntegracao, StatusViagem, TipoMotorista, TipoProduto, Turno } from "@prisma/client";
import { DefaultSession } from "next-auth";

export type NovoMotoristaInput = {
    nome: string;
    cpf: string;
    seva: number;
    diasTrabalhados: number;
    turno: Turno;
    tipo: TipoMotorista;
    produtosAutorizados: TipoProduto[];
    integracao: NovaIntegracaoInput[];
};

export type NovaIntegracaoInput = {
    dataValidade: string | Date;
    cliente: string;
    status: StatusIntegracao;
};

export type NovaEntregaInput = {
  dataEntrega: string | Date;
  cliente: string;
  cidade: string;
  uf: string;
  kg: number;
  m3: number;
  obs: string;
  sapcode: string;
  codewhite: string;
};

export type NovaViagemInput = {
  numViagem: string;
  carreta: string;
  cavalo: string;
  tanque: string;
  diasViagem: number;
  inicioPrevisto: string | Date;
  fimPrevisto: string | Date;
  turno: Turno;
  produto: TipoProduto;
  status?: StatusViagem;
  viagemExtra?: boolean;
  entregas: NovaEntregaInput[];
};

export type EditarEntregaInput = NovaEntregaInput & {
  id?: number;
};

export type EditarViagemInput = Omit<NovaViagemInput, 'entregas'> & {
  entregas: EditarEntregaInput[];
  motoristaId?: number | null;
  motoristaAcompanhanteId?: number | null;
  status?: StatusViagem;
};

export type EditarIntegracaoInput = NovaIntegracaoInput & {
  id?: number;
};

export type EditarMotoristaInput = Omit<NovoMotoristaInput, 'integracao'> & {
  integracao: EditarIntegracaoInput[];
};

/** Formato padrão de retorno de toda server action (criar/editar/deletar/atualizar) */
export type RespostaAcao = { sucesso: true } | { sucesso: false; erro: string };

export type FalhaImportacaoViagem = {
  numViagem: string;
  erro: string;
};

export type ResultadoImportacaoLote = {
  sucesso: boolean;
  criadas: number;
  falhas: FalhaImportacaoViagem[];
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      filialId: number | null;
      /** Só no papel MOTORISTA: o motorista do cadastro dono do acesso. */
      motoristaId?: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    filialId: number | null;
    motoristaId?: number | null;
    versaoSessao?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    filialId: number | null;
    motoristaId?: number | null;
    /** Usuario.versaoSessao no login — se mudou (PIN novo), a sessão cai. */
    versaoSessao?: number;
    /** Momento do login (ms) — a sessão vale 12h a partir daqui. */
    loginEm?: number;
  }
}