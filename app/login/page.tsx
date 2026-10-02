'use client'

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LogoEscalador } from "@/components/layout/logo-escalador"
import { Rodape } from "@/components/layout/rodape"
import { AREA_MOTORISTA } from "@/lib/papeis"
import { cn } from "@/lib/utils"
import { MENSAGEM_SEM_CONEXAO } from "@/lib/chamar-acao"

type Modo = "despacho" | "motorista"

function normalizarErroLogin(erro: string) {
  if (erro === "CredentialsSignin") {
    return "Credenciais inválidas."
  }

  if (
    /prisma/i.test(erro) ||
    /invalid/i.test(erro) ||
    /constraint/i.test(erro) ||
    /P\d{4}/i.test(erro)
  ) {
    return "Não foi possível realizar o login no momento. Tente novamente."
  }

  return erro
}

async function servidorAlcancavel(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false
  try {
    const resposta = await fetch("/api/auth/providers", { cache: "no-store" })
    return resposta.ok
  } catch {
    return false
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>("despacho")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [seva, setSeva] = useState("")
  const [pin, setPin] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)


    // Sem conexão, o signIn do next-auth não lança: ele mesmo redireciona pra
    // uma página de erro (no celular vira a tela "sem internet" do navegador).
    // Então testa a conexão antes, e avisa aqui mesmo.
    if (!(await servidorAlcancavel())) {
      setErro(MENSAGEM_SEM_CONEXAO)
      setCarregando(false)
      return
    }

    let resultado: Awaited<ReturnType<typeof signIn>>
    try {
      resultado =
        modo === "motorista"
          ? await signIn("motorista", { seva, pin, redirect: false })
          : await signIn("credentials", { email, senha, redirect: false })
    } catch {
      // Sem internet: avisa em vez de deixar o botão em "Autenticando..." pra sempre.
      setErro(MENSAGEM_SEM_CONEXAO)
      setCarregando(false)
      return
    }

    if (resultado?.error) {
      setErro(normalizarErroLogin(resultado.error))
      setCarregando(false)
    } else {
      router.push(modo === "motorista" ? AREA_MOTORISTA : "/")
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted p-4">
      <Card className="w-full max-w-100 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-2 flex justify-center text-foreground">
            <LogoEscalador />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">Entrar</CardTitle>
          <CardDescription>
            {modo === "motorista" ? "Use sua matrícula (SEVA) e o PIN que o escalador te passou" : "Insira suas credenciais para acessar a operação"}
          </CardDescription>
          <div className="mx-auto mt-3 inline-flex rounded-lg border bg-muted/40 p-1" role="group" aria-label="Tipo de acesso">
            {(["despacho", "motorista"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={modo === opcao}
                onClick={() => {
                  setModo(opcao)
                  setErro("")
                }}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm transition-colors",
                  modo === opcao
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opcao === "despacho" ? "Escalador" : "Motorista"}
              </button>
            ))}
          </div>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pb-4">
            {modo === "motorista" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="seva">Matrícula (SEVA)</Label>
                  <Input
                    id="seva"
                    inputMode="numeric"
                    autoComplete="username"
                    placeholder="Ex: 261"
                    value={seva}
                    onChange={(e) => setSeva(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
              </>
            ) : (
            <>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu e-mail aqui"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input 
                id="senha" 
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            </>
            )}

            {}
            {erro && (
              <div className="text-sm text-red-500 font-medium text-center">
                {erro}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={carregando}
            >
              {carregando ? "Autenticando..." : "Entrar no Sistema"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Rodape className="w-full max-w-100" />
    </div>
  )
}