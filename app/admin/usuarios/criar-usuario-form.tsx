"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch, type Resolver, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle } from "lucide-react"
import { criarUsuario } from "@/lib/actions/usuarios"
import { usuarioSchema, type UsuarioFormValues } from "@/lib/validation/usuarios"

type Props = {
  filiais: Array<{ id: number; nome: string }>
}

export default function CriarUsuarioForm({ filiais }: Props) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)

  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioSchema) as Resolver<UsuarioFormValues>,
    defaultValues: { nome: "", email: "", senha: "", role: "DESPACHANTE", filialId: null },
  })

  const roleSelecionado = useWatch({ control: form.control, name: "role" })
  const ehSuperAdmin = roleSelecionado === "SUPERADMIN"

  const handleSubmit: SubmitHandler<UsuarioFormValues> = async (dados) => {
    setErro(null)
    const resposta = await criarUsuario(dados)

    if (!resposta.sucesso) {
      setErro(resposta.erro ?? "Não foi possível criar o usuário.")
      return
    }

    form.reset({ nome: "", email: "", senha: "", role: "DESPACHANTE", filialId: null })
    router.refresh()
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg">Novo usuário</CardTitle>
        <CardDescription>ADMIN e DESPACHANTE pertencem a uma filial e só enxergam os dados dela. SUPERADMIN não pertence a nenhuma.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Maria Souza" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="maria@transportadora.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField control={form.control} name="senha" render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha provisória</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Mínimo de 8 caracteres" {...field} />
                  </FormControl>
                  <FormDescription>A pessoa pode trocar depois pelo próprio painel de usuário.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (value === "SUPERADMIN") {
                        form.setValue("filialId", null)
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DESPACHANTE">Despachante</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SUPERADMIN">Superadmin (sem filial)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="filialId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Filial</FormLabel>
                  <Select
                    disabled={ehSuperAdmin}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={ehSuperAdmin ? "Não se aplica" : "Selecione a filial"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filiais.map((filial) => (
                        <SelectItem key={filial.id} value={String(filial.id)}>
                          {filial.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {erro && <Alert variant="error">{erro}</Alert>}

            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <PlusCircle className="w-4 h-4 mr-2" />
                {form.formState.isSubmitting ? "Criando..." : "Criar usuário"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
