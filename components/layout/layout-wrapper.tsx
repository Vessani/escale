'use client'

import { ReactNode, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Truck,
  Users,
  LayoutDashboard,
  LogOut,
  Route,
  Container,
  Menu,
  X,
  Building2,
  UserCog,
  Building,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Session } from "next-auth"
import { Dialog } from "radix-ui"

const CHAVE_SIDEBAR_COLAPSADA = "escalador:sidebar-colapsada"

// Preferência de sidebar colapsada/expandida, lembrada por navegador via
// localStorage. Usa useSyncExternalStore (não useState+useEffect) pra ler o
// valor real do cliente sem gerar mismatch de hidratação: no servidor
// sempre "expandida" (getServerSnapshot), e só troca pro valor salvo depois
// que o React reconcilia no cliente — sem piscar nem duplicar render.
const ouvintesColapsada = new Set<() => void>()

function lerColapsadaSalva() {
  return window.localStorage.getItem(CHAVE_SIDEBAR_COLAPSADA) === "true"
}

function lerColapsadaNoServidor() {
  return false
}

function inscreverColapsada(ouvinte: () => void) {
  ouvintesColapsada.add(ouvinte)
  return () => ouvintesColapsada.delete(ouvinte)
}

function definirColapsadaSalva(valor: boolean) {
  window.localStorage.setItem(CHAVE_SIDEBAR_COLAPSADA, String(valor))
  ouvintesColapsada.forEach((ouvinte) => ouvinte())
}

// Lista de rotas do sistema para montarmos o menu automaticamente
const menuItemsOperacional = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/viagens", label: "Gestão de Viagens", icon: Truck },
  { href: "/viagens/alocacao", label: "Alocação", icon: Route },
  { href: "/motorista", label: "Motoristas", icon: Users },
  { href: "/frotas", label: "Frotas", icon: Container },
  { href: "/clientes", label: "Clientes", icon: Building },
]

// SUPERADMIN não pertence a nenhuma filial — só gerencia o cadastro de
// filiais e usuários, sem acesso às telas operacionais (ver proxy.ts).
const menuItemsSuperAdmin = [
  { href: "/admin/filiais", label: "Filiais", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuários", icon: UserCog },
]

function LinksDoMenu({
  pathname,
  role,
  colapsado = false,
  aoNavegar,
}: {
  pathname: string
  role?: string
  colapsado?: boolean
  aoNavegar?: () => void
}) {
  const menuItems = role === "SUPERADMIN" ? menuItemsSuperAdmin : menuItemsOperacional

  return (
    <nav aria-label="Navegação principal" className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
      {menuItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={aoNavegar}
            aria-current={isActive ? "page" : undefined}
            title={colapsado ? item.label : undefined}
            className={`flex items-center rounded-lg transition-colors group ${
              colapsado ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
            } ${
              isActive
                ? "bg-blue-600/10 text-blue-400 font-medium"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`w-5 h-5 shrink-0 ${colapsado ? "" : "mr-3"} ${isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-300"}`}
            />
            <span className={colapsado ? "sr-only" : ""}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function PainelUsuario({ usuario, colapsado = false }: { usuario: Session["user"]; colapsado?: boolean }) {
  return (
    <div className="p-3 bg-slate-950/50 border-t border-slate-800">
      <div className={`flex items-center ${colapsado ? "justify-center" : "mb-4"}`}>
        <div
          className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold uppercase shrink-0"
          title={colapsado ? usuario?.name ?? undefined : undefined}
        >
          {usuario?.name?.charAt(0) || "U"}
        </div>
        {!colapsado && (
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{usuario?.name}</p>
            <p className="text-xs text-slate-500 truncate">{usuario?.role}</p>
          </div>
        )}
      </div>

      {!colapsado && (
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center px-3 py-2 text-sm text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-md transition-colors"
        >
          <LogOut aria-hidden="true" className="w-4 h-4 mr-2" />
          Sair do Sistema
        </button>
      )}
      {colapsado && (
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Sair do Sistema"
          className="mt-3 w-full flex items-center justify-center px-3 py-2 text-sm text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-md transition-colors"
        >
          <LogOut aria-hidden="true" className="w-4 h-4" />
          <span className="sr-only">Sair do Sistema</span>
        </button>
      )}
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
  // Colapsada = só ícones, dá mais espaço pro conteúdo em telas menores/tabelas
  // largas. Preferência lembrada por navegador (ver definirColapsadaSalva acima).
  const colapsada = useSyncExternalStore(inscreverColapsada, lerColapsadaSalva, lerColapsadaNoServidor)
  // Só liga a transição de largura depois do primeiro toggle manual — sem
  // isso, quem já estava com a sidebar colapsada veria uma animação de
  // "fechando" a cada carregamento de página, por causa da correção de
  // hidratação (primeiro render sempre parte de "expandida").
  const [animarColapso, setAnimarColapso] = useState(false)

  const alternarColapso = () => {
    setAnimarColapso(true)
    definirColapsadaSalva(!colapsada)
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Sidebar fixa, visível a partir do breakpoint md */}
      <aside
        className={`hidden md:flex relative flex-col bg-slate-900 text-slate-300 shadow-xl ${
          animarColapso ? "transition-[width] duration-200" : ""
        } ${colapsada ? "w-16" : "w-64"}`}
      >
        <div className="h-16 flex items-center px-4 bg-slate-950/50 text-white font-bold text-lg tracking-wider overflow-hidden">
          <Truck aria-hidden="true" className="w-5 h-5 mr-3 text-blue-500 shrink-0" />
          {!colapsada && "ESCALADOR"}
        </div>
        <LinksDoMenu pathname={pathname} role={usuario?.role} colapsado={colapsada} />
        <PainelUsuario usuario={usuario} colapsado={colapsada} />

        <button
          type="button"
          onClick={alternarColapso}
          aria-label={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"}
          title={colapsada ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-[4.5rem] flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 shadow hover:bg-slate-700 hover:text-white"
        >
          {colapsada ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Menu em drawer, só abaixo do breakpoint md */}
      <Dialog.Root open={menuAberto} onOpenChange={setMenuAberto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-slate-900 text-slate-300 shadow-xl md:hidden">
            <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
            <Dialog.Description className="sr-only">
              Menu principal do sistema com os links para as telas de dashboard, viagens, alocação, motoristas e frotas.
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
            <LinksDoMenu pathname={pathname} role={usuario?.role} aoNavegar={() => setMenuAberto(false)} />
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
