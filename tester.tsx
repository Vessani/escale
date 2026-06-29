import { prisma } from "./lib/prisma";
//import { criarViagem } from "./lib/actions/criarViagem";
//import { criarMotorista } from "./lib/actions/criarMotorista";



async function main() {
  const viagens = await prisma.viagem.findMany();
  console.log("All viagens:", JSON.stringify(viagens, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


  // Exemplo de como testar a função (adicione isso no final do seu script.tsx)
/*async function testar() {
    const payload = {
        nome: "João da Silva",
        seva: 12345,
        diasTrabalhados: 20,
        integracao: [
            {
                cliente: "Empresa XPTO",
                dataValidade: "2024-12-31T00:00:00Z",
                status: StatusIntegracao.ATIVO // Usando o Enum do Prisma
            }
        ]
    };

    await criarMotorista(payload);
}

testar();
*/
/*async function testar() {
  const payload = {
    numViagem: "885064",
    carreta: "ABC1234",
    cavalo: "XYZ5678",
    data: "2024-06-15T00:00:00Z",
    tanque: "Cheio",
    integracao: true,
    diasViagem: 5,
    entregas: [
      {
        dataEntrega: "2024-06-16T00:00:00Z",
        cliente: "Cliente A",
        cidade: "Cidade A", 
        uf: "SP",
        kg: 1000,
        m3: 10,
        obs: "Entrega sem observações",
        sapcode: "SAP123",
        codewhite: "CW123"
      }
    ]
  };

  await criarViagem(payload);
}

testar();
*/