import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Verifica se já existe um admin para não duplicar
    const adminExistente = await prisma.usuario.findUnique({
      where: { email: "admin@transportadora.com" }
    });

    if (adminExistente) {
      return NextResponse.json({ mensagem: "O usuário Admin já existe!" });
    }

    // 2. Criptografa a senha "123456"
    const senhaCriptografada = await bcrypt.hash("123456", 10);

    // 3. Salva no banco de dados
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome: "Administrador Geral",
        email: "admin@transportadora.com",
        senha: senhaCriptografada,
        role: "ADMIN", // Cargo com acesso total
      }
    });

    return NextResponse.json({ 
      mensagem: "Sucesso! Usuário criado.", 
      usuario: { nome: novoUsuario.nome, email: novoUsuario.email } 
    });

  } catch (erro) {
    console.error("Erro detalhado no banco:", erro);
    return NextResponse.json({ erro: "Falha ao criar usuário." }, { status: 500 });
  }
}