import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { AREA_MOTORISTA, ehAreaMotorista, ehMotorista } from "@/lib/papeis"

// SUPERADMIN não pertence a nenhuma filial — só acessa /admin (gestão de
// filiais/usuários); os demais papéis (ADMIN/DESPACHANTE) só acessam as
// telas operacionais, nunca /admin. Ver components/layout/layout-wrapper.tsx.
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const role = req.nextauth.token?.role
    const isAreaAdmin = pathname.startsWith("/admin")

    // Motorista só enxerga a área dele; o despacho não usa essa área.
    if (ehMotorista(role)) {
      return ehAreaMotorista(pathname) ? NextResponse.next() : NextResponse.redirect(new URL(AREA_MOTORISTA, req.url))
    }
    if (ehAreaMotorista(pathname)) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    if (role === "SUPERADMIN" && !isAreaAdmin) {
      return NextResponse.redirect(new URL("/admin/filiais", req.url))
    }

    if (role !== "SUPERADMIN" && isAreaAdmin) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
  },
  {
    pages: {
      signIn: "/login",
    },
  },
)

export const config = {
  matcher: [
    // Ícones e manifest ficam fora: a aba e a tela de login (sem sessão) precisam deles.
    // aprovar-estouro: página aberta pelo link do grupo de WhatsApp, sem login —
    // quem autoriza é o token do link (ver lib/services/estouro-jornada.service.ts).
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icone-|manifest.webmanifest|login|aprovar-estouro).*)",
  ],
}
