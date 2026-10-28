import "./globals.css"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { LayoutWrapper } from "@/components/layout/layout-wrapper"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { LayoutMotorista } from "@/components/layout/layout-motorista"
import { ehMotorista, ehTorre } from "@/lib/papeis"
import { buscarFiliais } from "@/lib/queries/filiais"
import { filialDaTorre } from "@/lib/torre"

const fonteSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const fonteMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: { default: "Escalador", template: "%s · Escalador" },
  description: "Sistema de Alocação e Gestão de Frotas",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pega a sessão do usuário direto do servidor
  const session = await getServerSession(authOptions)
  // Torre: o seletor de filial no topo das telas precisa da lista e da escolhida.
  const torre =
    session && ehTorre(session.user.role)
      ? {
          filiais: (await buscarFiliais()).map(({ id, nome }) => ({ id, nome })),
          filialId: await filialDaTorre(),
        }
      : undefined

  return (
    <html lang="pt-BR" className={`${fonteSans.variable} ${fonteMono.variable}`}>
      <body className="font-sans antialiased">
        {/* Se o usuário estiver logado, o LayoutWrapper desenha o menu e coloca o conteúdo dentro. 
            Se não estiver (ex: na tela de Login), ele renderiza apenas o conteúdo limpo. */}
        {session && ehMotorista(session.user.role) ? (
          <LayoutMotorista nome={session.user.name}>{children}</LayoutMotorista>
        ) : session ? (
          <LayoutWrapper usuario={session.user} torre={torre}>
            {children}
          </LayoutWrapper>
        ) : (
          children
        )}
      </body>
    </html>
  )
}
