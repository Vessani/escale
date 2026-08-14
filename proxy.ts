import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// SUPERADMIN não pertence a nenhuma filial — só acessa /admin (gestão de
// filiais/usuários); os demais papéis (ADMIN/DESPACHANTE) só acessam as
// telas operacionais, nunca /admin. Ver components/layout/layout-wrapper.tsx.
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;
    const isAreaAdmin = pathname.startsWith("/admin");

    if (role === "SUPERADMIN" && !isAreaAdmin) {
      return NextResponse.redirect(new URL("/admin/filiais", req.url));
    }

    if (role !== "SUPERADMIN" && isAreaAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
