# Comparação antes/depois — refatoração do parser de XLSX

> Nota (2026-07-07): este comparativo é sobre a refatoração do parser de XLSX (julho/2026). O projeto passou depois por uma revisão mais ampla (pastas, tipagem completa). Ver a nota equivalente no histórico de commits.

## 1. Arquitetura e organização

### Antes
```
lib/parsers/xlsx-parser.ts
├─ class XLSXParserViagem
│  ├─ static parseFromFile()    ← lê arquivo
│  ├─ static extractData()      ← extrai dados
│  └─ static converterParaFormulario() ← converte formato
├─ local formatarData()         ← não reutilizável
├─ local horaParaMinutos()      ← não reutilizável
└─ local formatarDateTimeLocal() ← não reutilizável
```

Uma classe concentrava três responsabilidades, com funções auxiliares aninhadas e não reutilizáveis.

### Depois
```
lib/utils/date-format.ts
├─ export formatarDataExcel()
├─ export normalizarHora()
├─ export calcularDiasEntre()
├─ export formatarDateTimeLocal()
└─ export validarNumeroPositivo()

lib/parsers/xlsx-parser.ts
├─ class XLSXFileReader           ← lê arquivo
├─ class XLSXDataExtractor        ← extrai dados
├─ class XLSXToFormDataConverter  ← converte formato
└─ class XLSXParserViagem         ← orquestra (facade)
```

Cada classe com uma responsabilidade; funções de formatação de data extraídas para um módulo reutilizável e testável isoladamente.

---

## 2. Tipagem

### Antes
```typescript
interface UploadXLSXViagemProps {
  onDataLoaded: (dados: any) => void
  onError?: (erro: string) => void
}

try {
  // ...
} catch {
  setErroGlobal("Erro")
}
```

`any` no callback principal e `catch` sem tipo — nenhum dos dois é pego pelo compilador.

### Depois
```typescript
import type { NovaViagemFormValues } from '@/lib/validation/viagens'

interface UploadXLSXViagemProps {
  onDataLoaded: (dados: NovaViagemFormValues) => void
  onError?: (erro: string) => void
}

try {
  // ...
} catch (error: unknown) {
  const mensagem = error instanceof Error ? error.message : "Erro desconhecido"
  setErroGlobal(mensagem)
}
```

---

## 3. Validação de dados extraídos

### Antes
```typescript
kg: row['N'] ? parseFloat(String(row['N'])) : 0,
m3: row['O'] ? parseFloat(String(row['O'])) : 0,
```

`parseFloat('abc')` retorna `NaN` sem avisar; valores negativos passavam sem checagem.

### Depois
```typescript
private static extrairNumeroPositivo(
  valor: any,
  nomeCampo: string,
  linha: number
): number {
  if (!valor) return 0
  return validarNumeroPositivo(valor, `${nomeCampo} (linha ${linha + 1})`)
}

export function validarNumeroPositivo(valor: any, campoNome: string): number {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor

  if (isNaN(num)) {
    throw new Error(`${campoNome} inválido: deve ser um número`)
  }
  if (num < 0) {
    throw new Error(`${campoNome} inválido: deve ser positivo`)
  }
  return num
}
```

---

## 4. Cálculo de duração da viagem

### Antes — incorreto
```typescript
diasViagem: Math.max(dados.entregas.length, 1)
```
Cinco entregas no mesmo dia resultavam em `diasViagem = 5`, quando o correto seria 1.

### Depois — correto
```typescript
const dataFimCalculada = this.calcularDataFim(dados.entregas)
const diasViagem = calcularDiasEntre(dataInicioDate, dataFimCalculada)

export function calcularDiasEntre(dataInicio: Date, dataFim: Date): number {
  const diffMs = dataFim.getTime() - dataInicio.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1)
}
```

---

## 5. Validação de upload

### Antes
```typescript
if (!file.name.match(/\.(xlsx|xls)$/i)) {
  throw new Error('Arquivo inválido')
}
```
Só checava a extensão do nome do arquivo — trivial de falsificar, sem limite de tamanho.

### Depois
```typescript
private static validateFile(file: File): void {
  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]

  if (file.type && !validMimeTypes.includes(file.type)) {
    throw new Error(`Tipo inválido: ${file.type}`)
  }

  if (!validExtensions.test(file.name)) {
    throw new Error('Nome de arquivo inválido')
  }

  const maxSizeBytes = 10 * 1024 * 1024
  if (file.size > maxSizeBytes) {
    throw new Error(`Arquivo > 10MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
  }
}
```

---

## 6. Separação de responsabilidades

### Antes
```typescript
export class XLSXParserViagem {
  static parseFromFile(file: File) {
    // valida arquivo, lê binário, converte pra XLSX,
    // extrai dados, valida dados, converte formato — tudo aqui
  }
}
```

### Depois
```typescript
class XLSXFileReader {
  static validateFile(file: File): void { }
  static readFile(file: File): Promise<any[]> { }
}

class XLSXDataExtractor {
  static extract(jsonData: any[]): DadosViagemPlanilha { }
  private static findStartRow(jsonData: any[]): number { }
  private static extrairEntregas(...): DadosEntregaPlanilha[] { }
}

class XLSXToFormDataConverter {
  static convert(dados: DadosViagemPlanilha) { }
  private static parseDataTimeLocal(dateTimeLocal: string): Date { }
  private static calcularDataFim(entregas): Date { }
}

export class XLSXParserViagem {
  static async parseFromFile(file: File) {
    return await XLSXFileReader.readFile(file)
  }
  static converterParaFormulario(dados) {
    return XLSXToFormDataConverter.convert(dados)
  }
}
```

---

## 7. Funções duplicadas/aninhadas

### Antes
Três funções de formatação de data definidas dentro do parser, sem exportação — qualquer outro arquivo que precisasse da mesma lógica teria que duplicá-la.

### Depois
Movidas para `lib/utils/date-format.ts`, exportadas e reutilizadas em qualquer ponto do projeto:

```typescript
export function formatarDataExcel(data: string | Date, hora?: string): string { }
export function normalizarHora(hora: string): string { }
export function calcularDiasEntre(dataInicio: Date, dataFim: Date): number { }
export function formatarDateTimeLocal(date: Date, hora?: string): string { }
export function validarNumeroPositivo(valor: any, campoNome: string): number { }
```

---

## Resumo

| Critério | Antes | Depois |
|----------|-------|--------|
| Classes com responsabilidade única | 1 classe, 3 responsabilidades | 4 classes, 1 cada |
| Funções de formatação reutilizáveis | 0 (aninhadas) | 5 (exportadas) |
| Tipagem | `any` em pontos-chave | sem `any` |
| Validação de dados extraídos | básica | com erro e contexto por linha |
| Validação de upload | só extensão | MIME type + extensão + tamanho |
| Cálculo de duração da viagem | incorreto (contava entregas) | correto (diferença de datas) |
