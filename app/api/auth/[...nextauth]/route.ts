import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Exporta as rotas para o Next.js saber como lidar com as requisições de login
export { handler as GET, handler as POST };