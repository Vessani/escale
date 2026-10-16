import Link from "next/link"
import { Alert } from "@/components/ui/alert"
import { formatarNomeProprio } from "@/lib/utils/texto"

type Props = {
  motoristas: Array<{ id: number; nome: string }>
  /** Onde aparece muda o porquê que importa pra quem lê. */
  contexto?: "cadastro" | "importacao"
}

/**
 * Motoristas sem nenhum produto autorizado: o bloqueio de produto é rígido,
 * então eles somem da sugestão de toda viagem com produto. Cada nome leva
 * direto pro cadastro, pra marcar os produtos. Sem ninguém, não mostra nada.
 */
export function AvisoMotoristasSemProduto({ motoristas, contexto = "cadastro" }: Props) {
  if (motoristas.length === 0) return null
  const quantos = motoristas.length === 1 ? "1 motorista está" : `${motoristas.length} motoristas estão`

  return (
    <Alert variant="warning">
      <div className="space-y-1">
        <p className="font-medium">{quantos} sem produto autorizado</p>
        <p className="text-sm">
          {contexto === "importacao"
            ? "Não entram na sugestão destas viagens, nem como opção compatível. "
            : "Não entram na sugestão de nenhuma viagem com produto. "}
          Marque no cadastro quais produtos cada um pode levar:{" "}
          {motoristas.map((motorista, indice) => (
            <span key={motorista.id}>
              {indice > 0 && ", "}
              <Link href={`/motorista/editar/${motorista.id}`} className="font-medium underline underline-offset-2">
                {formatarNomeProprio(motorista.nome)}
              </Link>
            </span>
          ))}
          .
        </p>
      </div>
    </Alert>
  )
}
