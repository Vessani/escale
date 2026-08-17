# Importação de viagens via .xls — notas de implementação

## Escopo

Importação de dados de viagem a partir de arquivos Excel (.xlsx/.xls), preenchendo automaticamente os campos do formulário de nova viagem.

## Arquivos

### Parser de XLSX
- `lib/parsers/xlsx-parser.ts`
- Lê arquivos .xlsx/.xls, mapeia colunas para dados de viagem, converte para o formato do formulário.
- Suporta múltiplos formatos de data (DD.MM, DD.MM.YYYY, serial Excel).

### Componente de upload
- `components/viagem/upload-xlsx-viagem.tsx`
- Upload com drag-and-drop, validação de arquivo, feedback de sucesso/erro, integração com React Hook Form.
- Arquivo com múltiplas viagens: lista todas as encontradas, com opção de importar todas de uma vez (`criarViagensEmLote`) ou carregar uma por vez no formulário.

### Integração no formulário
- `app/viagens/nova/page.tsx`
- Componente de upload no topo da página; callback preenche o formulário automaticamente.

### Testes
- `lib/parsers/xlsx-parser.test.ts` — parse de número de viagem, parse de múltiplas entregas, conversão para formato de formulário.

### Documentação relacionada
- `docs/IMPORTACAO_XLSX.md` — guia de uso, mapeamento de colunas, resolução de problemas.
- `docs/EXEMPLO_IMPORT_VIAGEM.txt` — exemplo de formatação esperada.

## Dependências

```bash
npm install xlsx
```

## Mapeamento de colunas

Conferido diretamente contra um arquivo real (tabela completa em `docs/IMPORTACAO_XLSX.md`):

| Coluna | Campo | Exemplo |
|--------|-------|---------|
| C | Nº Viagem | 893892 |
| F | Carreta | 908 |
| J | Cavalo | 2064 |
| K | Data (viagem/entrega) | 04.07 |
| L | Hora (viagem/entrega) | 08:45 |
| AD | Tanque | STCV-28 |
| M | SAP Code | 90003246 |
| O | Code White | 77712 |
| R | Cliente | SEMEATO 1 - AR L |
| U | Cidade | PASSO FUNDO |
| V | UF | RS |
| Y | Peso (KG) | 2228 |
| AC | Cubagem (M³) | 1346 |
| S | Observações | (geralmente vazio, usa texto padrão) |

## Fluxo de uso

1. Acessar `/viagens/nova`.
2. Carregar arquivo (clique ou arraste .xlsx).
3. O sistema faz o parse e detecta uma ou N viagens.
4. Uma viagem: formulário preenchido automaticamente, revisar e "Finalizar Viagem".
5. Várias viagens: "Importar todas" (cria todas sem motorista e leva para `/viagens/alocacao`) ou carregar uma por vez no formulário.

## Características

- Upload via clique ou drag-and-drop.
- Validação automática de arquivo (MIME type, extensão, tamanho).
- Suporte a múltiplos formatos de data.
- Múltiplas entregas e múltiplas viagens em um único arquivo.
- Importação em lote com relatório de sucesso/falha por viagem.
- Edição manual após importação.

## Testes e build

```bash
npm test
npm run build
```
