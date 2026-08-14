import { buscarClientes } from "@/lib/queries/clientes"
import NovoMotoristaClient from "./novo-motorista-client"

export default async function NovoMotoristaPage() {
  const clientes = await buscarClientes()

  return <NovoMotoristaClient clientes={clientes} />
}
