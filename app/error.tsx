"use client"

import { TelaErro } from "@/components/erro/tela-erro"

/** Erro dentro de uma página: troca só o conteúdo, o menu e o layout continuam. */
export default function Erro(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <TelaErro {...props} />
}
