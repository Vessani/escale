export const CONTENT_TYPE_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Resposta de download de .xlsx (nome já sanitizado, sem a extensão). */
export function respostaExcel(buffer: Buffer, nomeArquivo: string): Response {
  return new Response(new Blob([new Uint8Array(buffer)], { type: CONTENT_TYPE_EXCEL }), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE_EXCEL,
      "Content-Disposition": `attachment; filename="${nomeArquivo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
