'use client'

import { ReactNode, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Truck,
  Users,
  UserX,
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
  FileSpreadsheet,
  History,
} from "lucide-react"
import { Session } from "next-auth"
import { ehGerencia } from "@/lib/papeis"
import { Dialog } from "radix-ui"
import TrocarSenhaDialog from "@/components/usuario/trocar-senha-dialog"
import { LogoEscalador } from "@/components/layout/logo-escalador"
import { Rodape } from "@/components/layout/rodape"

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
  { href: "/motorista/sem-viagem", label: "Motoristas Ociosos", icon: UserX },
  { href: "/frotas", label: "Frotas", icon: Container },
  { href: "/clientes", label: "Clientes", icon: Building },
  { href: "/relatorios", label: "Relatórios", icon: FileSpreadsheet },
  { href: "/historico", label: "Histórico", icon: History, soGerencia: true },
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
  const menuItems =
    role === "SUPERADMIN"
      ? menuItemsSuperAdmin
      : menuItemsOperacional.filter((item) => !("soGerencia" in item) || ehGerencia(role))

  return (
    <nav aria-label="Navegação principal" className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
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
            className={`relative flex items-center rounded-lg transition-colors group ${
              colapsado ? "justify-center px-2 py-2" : "px-3 py-2"
            } ${
              isActive
                ? "bg-white/10 text-white font-medium"
                : "hover:bg-white/5 hover:text-white"
            }`}
          >
            {isActive && (
              <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-full bg-destaque" />
            )}
            <Icon
              aria-hidden="true"
              className={`w-5 h-5 shrink-0 ${colapsado ? "" : "mr-3"} ${isActive ? "text-white" : "text-white/60 group-hover:text-white/80"}`}
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
    <div className="p-2.5 bg-black/20 border-t border-white/10">
      <div className={`flex items-center ${colapsado ? "justify-center" : "mb-2.5"}`}>
        <div
          className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white font-bold uppercase shrink-0"
          title={colapsado ? usuario?.name ?? undefined : undefined}
        >
          {usuario?.name?.charAt(0) || "U"}
        </div>
        {!colapsado && (
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{usuario?.name}</p>
            <p className="text-xs text-white/60 truncate">{usuario?.role}</p>
          </div>
        )}
      </div>

      {!colapsado && (
        <>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-center px-3 py-2 text-sm text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-md transition-colors"
          >
            <LogOut aria-hidden="true" className="w-4 h-4 mr-2" />
            Sair do Sistema
          </button>
          <TrocarSenhaDialog />
        </>
      )}
      {colapsado && (
        <>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Sair do Sistema"
            className="mt-3 w-full flex items-center justify-center px-3 py-2 text-sm text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-md transition-colors"
          >
            <LogOut aria-hidden="true" className="w-4 h-4" />
            <span className="sr-only">Sair do Sistema</span>
          </button>
          <TrocarSenhaDialog colapsado />
        </>
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
    <div className="flex h-screen bg-background overflow-hidden">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Sidebar fixa, visível a partir do breakpoint md */}
      <aside
        className={`hidden md:flex relative flex-col bg-sidebar text-white/80 shadow-xl ${
          animarColapso ? "transition-[width] duration-200" : ""
        } ${colapsada ? "w-16" : "w-64"}`}
      >
        <div className={`h-16 flex items-center bg-black/20 text-white overflow-hidden ${colapsada ? "justify-center px-2" : "px-4"}`}>
          <LogoEscalador compacto={colapsada} />
        </div>
        <LinksDoMenu pathname={pathname} role={usuario?.role} colapsado={colapsada} />
        <PainelUsuario usuario={usuario} colapsado={colapsada} />

        <button
          type="button"
          onClick={alternarColapso}
          aria-label={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"}
          title={colapsada ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-[4.5rem] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-sidebar text-white/80 shadow hover:brightness-125 hover:text-white"
        >
          {colapsada ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Menu em drawer, só abaixo do breakpoint md */}
      <Dialog.Root open={menuAberto} onOpenChange={setMenuAberto}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar text-white/80 shadow-xl md:hidden">
            <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
            <Dialog.Description className="sr-only">
              Menu principal do sistema com os links para as telas de dashboard, viagens, alocação, motoristas e frotas.
            </Dialog.Description>
            <div className="h-16 flex items-center justify-between px-6 bg-black/20 text-white">
              <LogoEscalador />
              <Dialog.Close
                aria-label="Fechar menu"
                className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
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
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu de navegação"
            className="rounded-md p-2 text-foreground/80 hover:bg-muted"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-foreground">
            <LogoEscalador />
          </span>
        </div>

        {/* flex-col + flex-1 no conteúdo: o rodapé fica no fim da tela mesmo em página curta */}
        <div id="conteudo-principal" className="flex flex-1 flex-col overflow-y-auto p-4 md:p-8">
          <div className="flex-1">{children}</div>
          <Rodape className="mt-12" />
        </div>
      </main>
    </div>
  )
}
