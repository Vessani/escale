'use client'

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Truck, Users, LayoutDashboard, LogOut, Settings, Route } from "lucide-react"
import { Session } from "next-auth"

// Lista de rotas do sistema para montarmos o menu automaticamente
const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/viagens", label: "Gestão de Viagens", icon: Truck },
  { href: "/viagens/alocacao", label: "Alocação", icon: Route },
  { href: "/motorista", label: "Motoristas", icon: Users },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

export function LayoutWrapper({ 
  children, 
  usuario 
}: { 
  children: ReactNode, 
  usuario: Session["user"] // <--- O TypeScript agora sabe exatamente quem é o usuário!
}) {
  const pathname = usePathname() // Descobre em qual página o usuário está

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      {/* ==========================================
          BARRA LATERAL (SIDEBAR) 
          ========================================== */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl">
        <div className="h-16 flex items-center px-6 bg-slate-950/50 text-white font-bold text-lg tracking-wider">
          <Truck className="w-5 h-5 mr-3 text-blue-500" />
          TRANSPO DIGITAL
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            // Verifica se a rota atual é a mesma do botão para pintá-lo de azul
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg transition-colors group ${
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-medium" 
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-300"}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ==========================================
            RODAPÉ DA BARRA LATERAL (DADOS DO USUÁRIO) 
            ========================================== */}
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
            <LogOut className="w-4 h-4 mr-2" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* ==========================================
          ÁREA DE CONTEÚDO PRINCIPAL (ONDE AS TELAS ENTRAM) 
          ========================================== */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Aqui é onde a Tabela de Viagens, Motoristas, etc. vai aparecer */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}