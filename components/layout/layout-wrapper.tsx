'use client'

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Truck, Users, LayoutDashboard, LogOut, Route, Menu, X } from "lucide-react"
import { Session } from "next-auth"
import { Dialog } from "radix-ui"

// Lista de rotas do sistema para montarmos o menu automaticamente
const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/viagens", label: "Gestão de Viagens", icon: Truck },
  { href: "/viagens/alocacao", label: "Alocação", icon: Route },
  { href: "/motorista", label: "Motoristas", icon: Users },
]

function LinksDoMenu({ pathname, aoNavegar }: { pathname: string; aoNavegar?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
      {menuItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={aoNavegar}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center px-3 py-2.5 rounded-lg transition-colors group ${
              isActive
                ? "bg-blue-600/10 text-blue-400 font-medium"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`w-5 h-5 mr-3 ${isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-300"}`}
            />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function PainelUsuario({ usuario }: { usuario: Session["user"] }) {
  return (
    <div className="p-4 bg-slate-950/50 border-t border-slate-800">
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold uppercase mr-3 shrink-0">
          {usuario?.name?.charAt(0) || "U"}
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-medium text-white truncate">{usuario?.name}</p>
          <p className="text-xs text-slate-500 truncate">{usuario?.role}</p>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="w-full flex items-center justify-center px-3 py-2 text-sm text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-md transition-colors"
      >
        <LogOut aria-hidden="true" className="w-4 h-4 mr-2" />
        Sair do Sistema
      </button>
    </div>
  )
}

export function LayoutWrapper({
  children,
  usuario
}: {
  children: ReactNode,
  usuario: Session["user"]
}) {
  const pathname = usePathname()
  // Fecha automaticamente ao clicar num link (ver `aoNavegar` passado a LinksDoMenu)
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Sidebar fixa, visível a partir do breakpoint md */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col shadow-xl">
        <div className="h-16 flex items-center px-6 bg-slate-950/50 text-white font-bold text-lg tracking-wider">
          <Truck aria-hidden="true" className="w-5 h-5 mr-3 text-blue-500" />
          ESCALADOR
        </div>
        <LinksDoMenu pathname={pathname} />
        <PainelUsuario usuario={usuario} />
      </aside>

      {/* Menu em drawer, só abaixo do breakpoint md */}
      <Dialog.Root open={menuAberto} onOpenChange={setMenuAberto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-slate-900 text-slate-300 shadow-xl md:hidden">
            <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
            <Dialog.Description className="sr-only">
              Menu principal do sistema com os links para as telas de dashboard, viagens, alocação e motoristas.
            </Dialog.Description>
            <div className="h-16 flex items-center justify-between px-6 bg-slate-950/50 text-white font-bold text-lg tracking-wider">
              <span className="flex items-center">
                <Truck aria-hidden="true" className="w-5 h-5 mr-3 text-blue-500" />
                ESCALADOR
              </span>
              <Dialog.Close
                aria-label="Fechar menu"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>
            <LinksDoMenu pathname={pathname} aoNavegar={() => setMenuAberto(false)} />
            <PainelUsuario usuario={usuario} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Cabeçalho só em telas abaixo de md, com botão para abrir o menu */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu de navegação"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="flex items-center font-bold text-slate-900">
            <Truck aria-hidden="true" className="w-5 h-5 mr-2 text-blue-600" />
            ESCALADOR
          </span>
        </div>

        <div id="conteudo-principal" className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
