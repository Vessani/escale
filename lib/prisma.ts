import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const prismaClientSingleton = () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // O Pool é um EventEmitter; erro num client ocioso do pool (ex: o Postgres
  // remoto derrubando uma conexão parada, comum em provedores gerenciados
  // tipo Supabase) emite 'error' — sem um listener aqui, o Node trata como
  // exceção não tratada e derruba o processo inteiro do servidor, tirando o
  // app do ar pra todo mundo por causa de uma única conexão ociosa. Só logar
  // e seguir: o pool descarta o client com erro e cria outro na próxima
  // consulta.
  pool.on("error", (erro) => {
    console.error("[prisma] Erro num client ocioso do pool de conexões:", erro);
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}