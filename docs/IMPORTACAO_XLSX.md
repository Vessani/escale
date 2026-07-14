# Importação de Viagens via Arquivo .XLS

## 📋 Visão Geral

O sistema suporta importação automática de dados de viagens através de arquivos Excel (.xlsx ou .xls). Isso facilita o trabalho dos despachantes, preenchendo automaticamente os campos da viagem com base nos dados fornecidos na planilha. Um mesmo arquivo pode conter uma ou várias viagens.

## 🚀 Como Usar

### 1. Acessar a Página de Nova Viagem
- Navegue até **Viagens > Nova Viagem**
- Você verá um card de importação no topo da página

### 2. Carregar o Arquivo
- Clique na zona de upload ou arraste um arquivo .xlsx/.xls
- O sistema processa o arquivo e identifica quantas viagens ele contém

### 3a. Arquivo com uma única viagem
- Os campos do formulário são preenchidos automaticamente
- Revise os dados e clique em **Finalizar Viagem** para salvar

### 3b. Arquivo com várias viagens
- Aparece uma lista com todas as viagens encontradas
- **Importar todas as N viagens**: cria todas direto no banco (sem motorista ainda) e leva para `/viagens/alocacao`, onde dá pra comparar a sugestão de motorista entre todas e ajustar manualmente se precisar
- **Carregar no formulário**: carrega só aquela viagem específica no formulário, para revisar/ajustar os campos antes de salvar (mesmo fluxo do item 3a)

## 📊 Formato Esperado da Planilha (arquivo AR.xls)

O parser (`lib/parsers/xlsx-parser.ts`) lê a planilha por **letra de coluna**, não pelo cabeçalho (o arquivo real tem células mescladas que deslocam o texto do cabeçalho em relação aos dados). O mapeamento abaixo foi conferido diretamente contra um arquivo real:

### Linha da viagem (início de cada bloco)
| Coluna | Campo | Exemplo |
|--------|-------|---------|
| C | Nº Viagem | 893892 |
| F | Carreta | 908 |
| J | Cavalo | 2064 |
| K | Data de início | 04.07. |
| L | Hora de início | 08:45 |
| AD | Tanque | STCV-28 |

### Linhas de entrega (uma ou mais logo abaixo de cada viagem)
| Coluna | Campo | Exemplo |
|--------|-------|---------|
| K | Data da entrega | 06.07. |
| L | Hora da entrega | 10:00 |
| M | SAP Code | 90003246 |
| O | Code White | 77712 |
| R | Cliente | SEMEATO 1 - AR L |
| U | Cidade | PASSO FUNDO |
| V | UF | RS |
| Y | Peso (KG) | 2228 |
| AC | Cubagem (M³) | 1346 |
| S | Observações | (geralmente vazio neste relatório — usa texto padrão) |

Uma nova viagem começa sempre que a coluna **C** tiver um novo número; as entregas são todas as linhas com a coluna **R** preenchida logo abaixo, até a próxima viagem.

## 🔄 Mapeamento Automático (regras de preenchimento)

- **Tanque**: vem da coluna AD da linha da viagem
- **Data Fim**: calculada automaticamente a partir da última entrega
- **Turno**: padrão "MANHÃ" (ajustável após importação)
- **Status**: padrão "CRIADA"
- **UF**: normalizada para maiúsculas, 2 letras (padrão "SP" se vazia)
- **SAP Code / Code White**: padrão "0" se vazios
- **Observação**: se a coluna S estiver vazia, usa "Confirmar com a programação antes de sair"

## ⚠️ Validações

- ✅ Arquivo é .xlsx ou .xls, até 10MB
- ✅ Contém pelo menos uma viagem (coluna C com número)
- ✅ Contém pelo menos uma entrega por viagem (coluna R preenchida)
- ✅ Datas em formato reconhecível (DD.MM, DD.MM.YYYY ou serial Excel)
- ✅ Antes de gravar no banco, cada viagem passa pela mesma validação Zod do formulário manual (`lib/validation/viagens.ts`) — limites de tamanho de campo (ex: nome do cliente até 100 caracteres) são pegos aqui, com mensagem específica, em vez de um erro genérico do banco

## 🐛 Resolução de Problemas

### "Nenhuma viagem encontrada na planilha"
- Verifique se a coluna C contém o número da viagem, em formato numérico

### "Nenhuma entrega encontrada para a viagem X"
- Verifique se a coluna R (Cliente) contém dados nas linhas abaixo da viagem

### Erro específico por viagem na importação em lote
- O resumo mostrado na tela lista exatamente qual viagem falhou e por quê (dado inválido ou número de viagem já existente no banco); as demais viagens do lote são criadas normalmente

### Datas não reconhecidas
O sistema tenta os formatos, nesta ordem:
- Já no formato `YYYY-MM-DDTHH:MM` (datetime-local)
- `DD.MM` (usa o ano atual)
- `DD.MM.YYYY`
- Serial numérico do Excel

## 💡 Dicas

1. **Edição pós-importação**: todos os campos podem ser editados depois, em `/viagens/editar/[id]`
2. **Revisão obrigatória**: sempre revise os dados importados antes de salvar (ou depois, na tela de edição)
3. **Reimportar o mesmo arquivo**: se uma viagem já foi criada, tentar importar de novo com o mesmo número dá erro de duplicidade — isso é esperado

## 🔧 Desenvolvimento

- `lib/parsers/xlsx-parser.ts` - leitura do arquivo e mapeamento de colunas
- `components/viagem/upload-xlsx-viagem.tsx` - interface de upload, lista de viagens encontradas e botão de importação em lote
- `lib/actions/viagens.ts` - `criarViagemAvulsa` (uma viagem, com auto-alocação de motorista) e `criarViagensEmLoteComAlocacao` (várias, com a alocação já decidida na tela de revisão)
- `lib/services/viagem.service.ts` - `criarViagemAvulsaService` / `criarViagemComAlocacaoService`

---

**Versão**: 2.0
**Última atualização**: 2026-07-07
