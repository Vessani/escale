'use client'

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)

    // Comunica-se com a nossa configuração no lib/auth.ts
    const resultado = await signIn("credentials", {
      email,
      senha,
      redirect: false, 
    })

    if (resultado?.error) {
      setErro(resultado.error)
      setCarregando(false)
    } else {
      // Login aprovado! Envia o despachante para o sistema
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-[400px] shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Transportadora Digital</CardTitle>
          <CardDescription>
            Insira suas credenciais para acessar a operação
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@transportadora.com"
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

            {/* Tratamento de erro elegante na tela */}
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
    </div>
  )
}