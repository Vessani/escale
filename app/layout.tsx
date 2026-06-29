import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { LayoutWrapper } from "@/components/layout/layout-wrapper"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Transportadora Digital",
  description: "Sistema de Alocação e Gestão de Frotas",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pega a sessão do usuário direto do servidor
  const session = await getServerSession(authOptions)

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* Se o usuário estiver logado, o LayoutWrapper desenha o menu e coloca o conteúdo dentro. 
            Se não estiver (ex: na tela de Login), ele renderiza apenas o conteúdo limpo. */}
        {session ? (
          <LayoutWrapper usuario={session.user}>
            {children}
          </LayoutWrapper>
        ) : (
          children
        )}
      </body>
    </html>
  )
}