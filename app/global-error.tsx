"use client"

import { useEffect } from "react"

/**
 * Erro no layout raiz (raro): substitui a página inteira, então não tem o
 * CSS do app — estilos inline, simples, em português.
 */
export default function ErroGeral({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <title>Escale — erro</title>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>O Escale não conseguiu abrir</h1>
          <p style={{ color: "#555", marginBottom: 20 }}>
            O que já estava salvo não foi perdido. Tente de novo em alguns segundos.
            {error.digest ? ` Código: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "8px 16px", borderRadius: 6, border: 0, background: "#0b4ea2", color: "#fff", cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  )
}
