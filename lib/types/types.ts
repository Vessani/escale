import type { StatusIntegracao, Turno } from "@prisma/client";
import { DefaultSession } from "next-auth";

export type NovoMotoristaInput = {
    nome: string;
    seva: number;
    diasTrabalhados: number;
    turno: Turno;
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
  entregas: NovaEntregaInput[];
};

export type EditarEntregaInput = NovaEntregaInput & {
  id?: number;
};

export type EditarViagemInput = Omit<NovaViagemInput, 'entregas'> & {
  entregas: EditarEntregaInput[];
  motoristaId?: number | null;
};

export type EditarIntegracaoInput = NovaIntegracaoInput & {
  id?: number;
};

export type EditarMotoristaInput = Omit<NovoMotoristaInput, 'integracao'> & {
  integracao: EditarIntegracaoInput[];
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}