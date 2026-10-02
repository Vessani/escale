import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { Adapter } from "next-auth/adapters";
import { autenticarMotorista, autenticarUsuario, DURACAO_SESSAO_SEGUNDOS, revalidarToken } from "@/lib/services/auth.service";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" }
      },
      async authorize(credentials, req) {
        return autenticarUsuario(credentials, req?.headers);
      }
    }),
    // Acesso do motorista (área "Minhas viagens"): matrícula + PIN.
    CredentialsProvider({
      id: "motorista",
      name: "Motorista",
      credentials: {
        seva: { label: "Matrícula (SEVA)", type: "text" },
        pin: { label: "PIN", type: "password" }
      },
      async authorize(credentials, req) {
        return autenticarMotorista(credentials, req?.headers);
      }
    })
  ],
  session: {
    strategy: "jwt",
    // 12h a partir do login. O cookie também expira nisso, e o callback jwt
    // confere loginEm pra que usar o sistema não estique a sessão além do turno.
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  },
  pages: {
    signIn: '/login',
  },
  // Sessão derrubada de propósito (expirou, usuário desativado) não é erro do
  // sistema: uma linha de aviso em vez do stack trace do next-auth.
  logger: {
    error(code, metadata) {
      const erro = (metadata instanceof Error ? metadata : (metadata as { error?: unknown })?.error) as Error | undefined;
      if (code === "JWT_SESSION_ERROR" && erro?.name === "SessaoInvalidaError") {
        console.warn(`[auth] sessão encerrada: ${erro.message}`);
        return;
      }
      console.error(`[next-auth][error][${code}]`, metadata);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.filialId = user.filialId;
        token.motoristaId = user.motoristaId ?? null;
        token.loginEm = Date.now();
        return token;
      }
      // Confere no banco a cada acesso: usuário desativado ou com papel
      // alterado passa a valer na hora (lançar aqui derruba a sessão).
      return revalidarToken(token);
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.filialId = token.filialId;
        session.user.motoristaId = token.motoristaId ?? null;
      }
      return session;
    }
  }
};
