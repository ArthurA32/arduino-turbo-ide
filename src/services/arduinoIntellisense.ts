import * as monaco from 'monaco-editor';

export interface ArduinoSymbolDoc {
  name: string;
  kind: monaco.languages.CompletionItemKind;
  detail: string;
  documentation: string;
  insertText?: string;
  insertTextRules?: monaco.languages.CompletionItemInsertTextRule;
  signature?: {
    label: string;
    documentation: string;
    parameters: { label: string; documentation: string }[];
  };
}

export const ARDUINO_SYMBOLS: ArduinoSymbolDoc[] = [
  // --- Digital I/O ---
  {
    name: 'pinMode',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void pinMode(uint8_t pin, uint8_t mode)',
    documentation: 'Configura o pino especificado como entrada (`INPUT`), saída (`OUTPUT`) ou entrada com pullup interno (`INPUT_PULLUP`).\n\n```cpp\npinMode(LED_BUILTIN, OUTPUT);\n```',
    insertText: 'pinMode(${1:pin}, ${2:OUTPUT});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'pinMode(uint8_t pin, uint8_t mode)',
      documentation: 'Configura o pino como INPUT, OUTPUT ou INPUT_PULLUP.',
      parameters: [
        { label: 'pin', documentation: 'Número do pino no Arduino/ESP32.' },
        { label: 'mode', documentation: 'INPUT, OUTPUT, INPUT_PULLUP ou INPUT_PULLDOWN.' }
      ]
    }
  },
  {
    name: 'digitalWrite',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void digitalWrite(uint8_t pin, uint8_t val)',
    documentation: 'Escreve um valor lógico ALTO (`HIGH`) ou BAIXO (`LOW`) em um pino digital.\n\n```cpp\ndigitalWrite(LED_BUILTIN, HIGH);\n```',
    insertText: 'digitalWrite(${1:pin}, ${2:HIGH});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'digitalWrite(uint8_t pin, uint8_t val)',
      documentation: 'Escreve HIGH ou LOW no pino digital.',
      parameters: [
        { label: 'pin', documentation: 'O número do pino digital.' },
        { label: 'val', documentation: 'HIGH (1) ou LOW (0).' }
      ]
    }
  },
  {
    name: 'digitalRead',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'int digitalRead(uint8_t pin)',
    documentation: 'Lê o valor de um pino digital especificado, retornando `HIGH` (1) ou `LOW` (0).\n\n```cpp\nint estado = digitalRead(2);\n```',
    insertText: 'digitalRead(${1:pin})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'digitalRead(uint8_t pin)',
      documentation: 'Lê o estado lógico do pino digital.',
      parameters: [
        { label: 'pin', documentation: 'O número do pino digital a ser lido.' }
      ]
    }
  },

  // --- Analog I/O ---
  {
    name: 'analogRead',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'int analogRead(uint8_t pin)',
    documentation: 'Lê o valor do pino analógico especificado (0-1023 no Arduino Uno; 0-4095 no ESP32).\n\n```cpp\nint sensorVal = analogRead(A0);\n```',
    insertText: 'analogRead(${1:pin})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'analogRead(uint8_t pin)',
      documentation: 'Lê a tensão analógica no pino especificado.',
      parameters: [
        { label: 'pin', documentation: 'O pino analógico (ex: A0, A1, ou GPIO 34 no ESP32).' }
      ]
    }
  },
  {
    name: 'analogWrite',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void analogWrite(uint8_t pin, int val)',
    documentation: 'Escreve um sinal PWM analógico simulado no pino (0 a 255).\n\n```cpp\nanalogWrite(9, 128); // 50% duty cycle\n```',
    insertText: 'analogWrite(${1:pin}, ${2:val});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'analogWrite(uint8_t pin, int val)',
      documentation: 'Gera uma onda PWM no pino selecionado.',
      parameters: [
        { label: 'pin', documentation: 'O pino PWM a ser acionado.' },
        { label: 'val', documentation: 'O duty cycle de 0 a 255.' }
      ]
    }
  },
  {
    name: 'analogReadResolution',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void analogReadResolution(uint8_t bits)',
    documentation: 'Define o tamanho (em bits) dos valores retornados por `analogRead()`. Padrão: 10 bits (Arduino) ou 12 bits (ESP32).',
    insertText: 'analogReadResolution(${1:12});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },

  // --- Tempo & Delays ---
  {
    name: 'delay',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void delay(unsigned long ms)',
    documentation: 'Pausa a execução do programa pelo número de milissegundos especificado.\n\n```cpp\ndelay(1000); // Aguarda 1 segundo\n```',
    insertText: 'delay(${1:1000});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'delay(unsigned long ms)',
      documentation: 'Pausa o programa pelo tempo em milissegundos.',
      parameters: [
        { label: 'ms', documentation: 'Duração da pausa em milissegundos.' }
      ]
    }
  },
  {
    name: 'delayMicroseconds',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void delayMicroseconds(unsigned int us)',
    documentation: 'Pausa a execução do programa pelo número de microssegundos especificado.',
    insertText: 'delayMicroseconds(${1:100});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },
  {
    name: 'millis',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'unsigned long millis()',
    documentation: 'Retorna o número de milissegundos decorridos desde que a placa iniciou o programa.\n\n```cpp\nunsigned long agora = millis();\n```',
    insertText: 'millis()',
    signature: {
      label: 'millis()',
      documentation: 'Retorna os milissegundos decorridos desde o boot.',
      parameters: []
    }
  },
  {
    name: 'micros',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'unsigned long micros()',
    documentation: 'Retorna o número de microssegundos decorridos desde o boot da placa.',
    insertText: 'micros()',
    signature: {
      label: 'micros()',
      documentation: 'Retorna os microssegundos decorridos desde o boot.',
      parameters: []
    }
  },

  // --- Serial Communication ---
  {
    name: 'Serial.begin',
    kind: monaco.languages.CompletionItemKind.Method,
    detail: 'void Serial.begin(unsigned long baud)',
    documentation: 'Inicializa a porta serial com o baud rate especificado.\n\n```cpp\nSerial.begin(115200);\n```',
    insertText: 'Serial.begin(${1:115200});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'Serial.begin(unsigned long baud)',
      documentation: 'Abre a porta serial com o baud rate especificado.',
      parameters: [
        { label: 'baud', documentation: 'Taxa em bps (ex: 9600, 115200, 921600).' }
      ]
    }
  },
  {
    name: 'Serial.println',
    kind: monaco.languages.CompletionItemKind.Method,
    detail: 'size_t Serial.println(val)',
    documentation: 'Envia dados pela porta serial com quebra de linha. Ideal para o Monitor Serial e Plotter Gráfico.\n\n```cpp\nSerial.println("Pronto");\n```',
    insertText: 'Serial.println(${1:val});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'Serial.println(val)',
      documentation: 'Imprime dados na serial com quebra de linha no final.',
      parameters: [
        { label: 'val', documentation: 'Texto, número ou variável.' }
      ]
    }
  },
  {
    name: 'Serial.print',
    kind: monaco.languages.CompletionItemKind.Method,
    detail: 'size_t Serial.print(val)',
    documentation: 'Envia dados pela porta serial sem quebra de linha.',
    insertText: 'Serial.print(${1:val});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'Serial.print(val)',
      documentation: 'Imprime dados na serial sem quebra de linha.',
      parameters: [
        { label: 'val', documentation: 'Texto ou valor.' }
      ]
    }
  },
  {
    name: 'Serial.available',
    kind: monaco.languages.CompletionItemKind.Method,
    detail: 'int Serial.available()',
    documentation: 'Retorna o número de bytes disponíveis para leitura no buffer serial.',
    insertText: 'Serial.available()',
    signature: {
      label: 'Serial.available()',
      documentation: 'Retorna a quantidade de bytes recebidos na fila serial.',
      parameters: []
    }
  },
  {
    name: 'Serial.read',
    kind: monaco.languages.CompletionItemKind.Method,
    detail: 'int Serial.read()',
    documentation: 'Lê o primeiro byte disponível da porta serial.',
    insertText: 'Serial.read()'
  },
  {
    name: 'Serial.printf',
    kind: monaco.languages.CompletionItemKind.Method,
    detail: 'int Serial.printf(const char *format, ...)',
    documentation: 'Imprime dados formatados no estilo printf (ótimo para ESP32 e Turbo IDE).\n\n```cpp\nSerial.printf("Hall_A:%d, Hall_B:%d\\n", a, b);\n```',
    insertText: 'Serial.printf("${1:Canal1:%d, Canal2:%d}\\n", ${2:val1}, ${3:val2});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },

  // --- Matemática & Mapeamento ---
  {
    name: 'map',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'long map(long x, long in_min, long in_max, long out_min, long out_max)',
    documentation: 'Re-mapeia um número de uma faixa para outra.\n\n```cpp\nint pwm = map(analogRead(A0), 0, 1023, 0, 255);\n```',
    insertText: 'map(${1:x}, ${2:in_min}, ${3:in_max}, ${4:out_min}, ${5:out_max})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'map(x, in_min, in_max, out_min, out_max)',
      documentation: 'Converte proporcionalmente um valor de uma escala para outra.',
      parameters: [
        { label: 'x', documentation: 'O valor a ser mapeado.' },
        { label: 'in_min', documentation: 'Limite inferior de entrada.' },
        { label: 'in_max', documentation: 'Limite superior de entrada.' },
        { label: 'out_min', documentation: 'Limite inferior de saída.' },
        { label: 'out_max', documentation: 'Limite superior de saída.' }
      ]
    }
  },
  {
    name: 'constrain',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'constrain(x, a, b)',
    documentation: 'Restringe um valor a ficar dentro do intervalo [a, b].',
    insertText: 'constrain(${1:x}, ${2:min}, ${3:max})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },

  // --- Interrupções ---
  {
    name: 'attachInterrupt',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'void attachInterrupt(pin, ISR, mode)',
    documentation: 'Associa uma rotina de serviço de interrupção (ISR) a um pino digital quando ocorre uma mudança de estado (RISING, FALLING, CHANGE ou LOW).',
    insertText: 'attachInterrupt(digitalPinToInterrupt(${1:pin}), ${2:funcaoISR}, ${3:RISING});',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    signature: {
      label: 'attachInterrupt(digitalPinToInterrupt(pin), ISR, mode)',
      documentation: 'Dispara a função ISR quando o pino mudar de estado.',
      parameters: [
        { label: 'pin', documentation: 'O pino da interrupção.' },
        { label: 'ISR', documentation: 'Nome da função (void callback).' },
        { label: 'mode', documentation: 'RISING, FALLING, CHANGE ou LOW.' }
      ]
    }
  },
  {
    name: 'digitalPinToInterrupt',
    kind: monaco.languages.CompletionItemKind.Function,
    detail: 'int digitalPinToInterrupt(uint8_t pin)',
    documentation: 'Traduz o pino digital para o canal de interrupção de hardware correspondente.',
    insertText: 'digitalPinToInterrupt(${1:pin})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },

  // --- Constantes Globais ---
  { name: 'HIGH', kind: monaco.languages.CompletionItemKind.Constant, detail: '1 (Nível lógico alto / 3.3V ou 5V)', documentation: 'Nível lógico alto.' },
  { name: 'LOW', kind: monaco.languages.CompletionItemKind.Constant, detail: '0 (Nível lógico baixo / 0V / GND)', documentation: 'Nível lógico baixo (GND).' },
  { name: 'INPUT', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Modo de pino: Entrada', documentation: 'Configura o pino como entrada.' },
  { name: 'OUTPUT', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Modo de pino: Saída', documentation: 'Configura o pino como saída para atuadores.' },
  { name: 'INPUT_PULLUP', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Entrada com resistor Pull-up interno ativado', documentation: 'Configura o pino com resistor pull-up a VCC.' },
  { name: 'INPUT_PULLDOWN', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Entrada com resistor Pull-down interno (ESP32/ARM)', documentation: 'Configura o pino com resistor pull-down a GND.' },
  { name: 'LED_BUILTIN', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Pino do LED integrado da placa', documentation: 'Número do pino do LED da placa (Pino 13 no Uno, Pino 2 no ESP32).' },
  { name: 'RISING', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Interrupção na subida (LOW -> HIGH)', documentation: 'Gatilho de interrupção na borda de subida.' },
  { name: 'FALLING', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Interrupção na descida (HIGH -> LOW)', documentation: 'Gatilho de interrupção na borda de descida.' },
  { name: 'CHANGE', kind: monaco.languages.CompletionItemKind.Constant, detail: 'Interrupção em qualquer mudança', documentation: 'Gatilho de interrupção em qualquer borda.' },

  // --- Snippets Estruturais ---
  {
    name: 'setup_loop',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Estrutura padrão do Arduino (void setup e void loop)',
    documentation: 'Insere a estrutura básica padrão de um sketch Arduino.',
    insertText: 'void setup() {\n  // Inicialização:\n  Serial.begin(115200);\n  ${0}\n}\n\nvoid loop() {\n  // Código principal:\n\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },
  {
    name: 'for_loop',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Laço de repetição for',
    documentation: 'Insere um laço for indexado.',
    insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n  ${0}\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  },
  {
    name: 'sensor_hall',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Leitura de 3 Sensores Hall para Motor BLDC',
    documentation: 'Snippet completo de leitura de 3 sensores Hall digitais e envio para o Osciloscópio.',
    insertText: 'const int pinHallA = ${1:2};\nconst int pinHallB = ${2:3};\nconst int pinHallC = ${3:4};\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(pinHallA, INPUT_PULLUP);\n  pinMode(pinHallB, INPUT_PULLUP);\n  pinMode(pinHallC, INPUT_PULLUP);\n}\n\nvoid loop() {\n  int ha = digitalRead(pinHallA);\n  int hb = digitalRead(pinHallB);\n  int hc = digitalRead(pinHallC);\n  Serial.printf("Hall_A:%d, Hall_B:%d, Hall_C:%d\\n", ha, hb, hc);\n  delay(${4:10});\n}',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  }
];

export interface UserSymbol {
  name: string;
  kind: monaco.languages.CompletionItemKind;
  type: string;
  line: number;
}

export function extractUserSymbols(code: string): UserSymbol[] {
  const symbols: UserSymbol[] = [];

  // 1. Capturar #define NOMES valor
  const defineRegex = /#define\s+([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = defineRegex.exec(code)) !== null) {
    symbols.push({
      name: match[1],
      kind: monaco.languages.CompletionItemKind.Constant,
      type: 'Macro / Constante',
      line: 0
    });
  }

  // 2. Capturar funções: tipo nome(params) {
  const funcRegex = /\b(void|int|float|double|bool|boolean|char|uint8_t|uint16_t|uint32_t|unsigned long|long|String)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g;
  while ((match = funcRegex.exec(code)) !== null) {
    const returnType = match[1];
    const funcName = match[2];
    const params = match[3].trim();
    if (funcName !== 'setup' && funcName !== 'loop') {
      symbols.push({
        name: funcName,
        kind: monaco.languages.CompletionItemKind.Function,
        type: `${returnType} ${funcName}(${params})`,
        line: 0
      });
    }
  }

  // 3. Capturar variáveis: tipo nome = val; ou tipo nome;
  const varRegex = /\b(const\s+)?(int|float|double|bool|boolean|char|uint8_t|uint16_t|uint32_t|unsigned long|long|String|byte)\s+([a-zA-Z0-9_]+)(\s*=\s*[^;]+)?;?/g;
  while ((match = varRegex.exec(code)) !== null) {
    const isConst = !!match[1];
    const type = match[2];
    const varName = match[3];
    if (varName && varName !== 'setup' && varName !== 'loop') {
      symbols.push({
        name: varName,
        kind: isConst ? monaco.languages.CompletionItemKind.Constant : monaco.languages.CompletionItemKind.Variable,
        type: `${isConst ? 'const ' : ''}${type} ${varName}`,
        line: 0
      });
    }
  }

  return symbols;
}

export interface DiagnosticError {
  line: number;
  startColumn: number;
  endColumn: number;
  message: string;
  severity: monaco.MarkerSeverity;
}

export function lintArduinoCode(code: string): DiagnosticError[] {
  const errors: DiagnosticError[] = [];
  const lines = code.split('\n');

  let braceCount = 0;
  let parenCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\/\/.*$/, '').trim(); // Remove comentários
    const lineNum = i + 1;

    if (!line) continue;

    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
    }

    const isControlStructure = /^(if|for|while|switch|else|case|default|void|class|struct|#)/.test(line);
    const endsWithBlock = line.endsWith('{') || line.endsWith('}') || line.endsWith(':');
    const isPreprocessor = line.startsWith('#');

    // Alerta de ponto e vírgula esquecido
    if (!isControlStructure && !endsWithBlock && !isPreprocessor && !line.endsWith(';') && line.length > 2) {
      if (/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?\s*\(.*[^;]$/.test(line) || /\b(int|float|double|bool|char|uint8_t|unsigned long|String)\s+[a-zA-Z0-9_]+.*[^;{]$/.test(line)) {
        errors.push({
          line: lineNum,
          startColumn: rawLine.length,
          endColumn: rawLine.length + 1,
          message: 'Ponto e vírgula (;) esperado no final desta instrução.',
          severity: monaco.MarkerSeverity.Error
        });
      }
    }

    // Alerta de aspas não fechadas
    const quoteCount = (line.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0 && !line.includes('\\"')) {
      errors.push({
        line: lineNum,
        startColumn: 1,
        endColumn: rawLine.length + 1,
        message: 'Texto (string) não foi fechado com aspas duplas (").',
        severity: monaco.MarkerSeverity.Error
      });
    }
  }

  // Chaves desbalanceadas
  if (braceCount !== 0) {
    const lastLine = lines[lines.length - 1] || '';
    errors.push({
      line: lines.length,
      startColumn: 1,
      endColumn: lastLine.length + 1,
      message: braceCount > 0 
        ? `Existe(m) ${braceCount} chave(s) aberta(s) '{' sem fechamento '}'.` 
        : `Existe(m) ${Math.abs(braceCount)} chave(s) fechada(s) '}' a mais.`,
      severity: monaco.MarkerSeverity.Error
    });
  }

  return errors;
}

let isIntellisenseRegistered = false;

export function registerArduinoIntellisense() {
  if (isIntellisenseRegistered) return;
  isIntellisenseRegistered = true;

  // 1. Provedor de Autocompletar
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', ':', '>', '#', ' '],
    provideCompletionItems: (model, position) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn
      };

      const suggestions: monaco.languages.CompletionItem[] = [];

      // A. Símbolos Oficiais
      for (const item of ARDUINO_SYMBOLS) {
        suggestions.push({
          label: item.name,
          kind: item.kind,
          detail: item.detail,
          documentation: {
            value: item.documentation,
            isTrusted: true
          },
          insertText: item.insertText || item.name,
          insertTextRules: item.insertTextRules,
          range: range,
          sortText: `0_${item.name}`
        });
      }

      // B. Símbolos do Usuário
      const fullCode = model.getValue();
      const userSymbols = extractUserSymbols(fullCode || '');
      for (const userSym of userSymbols) {
        suggestions.push({
          label: userSym.name,
          kind: userSym.kind,
          detail: userSym.type,
          documentation: {
            value: `**Símbolo Definido pelo Usuário**\n\n\`${userSym.type}\``,
            isTrusted: true
          },
          insertText: userSym.name,
          range: range,
          sortText: `1_${userSym.name}`
        });
      }

      return { suggestions };
    }
  });

  // 2. Provedor de Assinaturas (Signature Help)
  monaco.languages.registerSignatureHelpProvider('cpp', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    provideSignatureHelp: (model, position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const match = textBeforeCursor.match(/([a-zA-Z0-9_.]+)\s*\(([^)]*)$/);
      if (!match) return null;

      const funcName = match[1];
      const argsSoFar = match[2];
      const activeParam = (argsSoFar.match(/,/g) || []).length;

      const symbol = ARDUINO_SYMBOLS.find(s => s.name === funcName && s.signature);
      if (!symbol || !symbol.signature) return null;

      const sig = symbol.signature;
      return {
        value: {
          signatures: [
            {
              label: sig.label,
              documentation: sig.documentation,
              parameters: sig.parameters.map(p => ({
                label: p.label,
                documentation: p.documentation
              }))
            }
          ],
          activeSignature: 0,
          activeParameter: Math.min(activeParam, sig.parameters.length - 1)
        },
        dispose: () => {}
      };
    }
  });

  // 3. Provedor de Documentação Hover
  monaco.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const symbol = ARDUINO_SYMBOLS.find(s => s.name === word.word);
      if (symbol) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: `**${symbol.name}** — \`${symbol.detail}\`` },
            { value: symbol.documentation }
          ]
        };
      }

      const fullCode = model.getValue();
      const userSymbols = extractUserSymbols(fullCode || '');
      const userSym = userSymbols.find(s => s.name === word.word);
      if (userSym) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: `**${userSym.name}** *(Símbolo do Usuário)*` },
            { value: `\`\`\`cpp\n${userSym.type}\n\`\`\`` }
          ]
        };
      }

      return null;
    }
  });
}