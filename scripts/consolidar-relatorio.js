import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

const fontes = [
  { nome: 'BACKEND', arquivo: path.join(projectRoot, 'reports', 'backend-junit.xml') },
  { nome: 'FRONTEND', arquivo: path.join(projectRoot, 'reports', 'frontend-junit.xml') },
  { nome: 'INTERFACE', arquivo: path.join(projectRoot, 'reports', 'e2e-junit.xml') }
];

function lerSuites(caminho) {
  if (!fs.existsSync(caminho)) return [];
  try {
    const raw = fs.readFileSync(caminho, 'utf-8');
    const json = parser.parse(raw);
    const raiz = json.testsuites?.testsuite ?? json.testsuite ?? [];
    return Array.isArray(raiz) ? raiz : [raiz];
  } catch (err) {
    console.error(`Erro ao ler XML de ${caminho}:`, err.message);
    return [];
  }
}

function extrairFalhas(suites) {
  const falhas = [];
  for (const suite of suites) {
    if (!suite) continue;
    const casos = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase].filter(Boolean);
    for (const caso of casos) {
      if (!caso) continue;
      const problema = caso?.failure ?? caso?.error;
      if (problema) {
        falhas.push({
          nome: caso.name || 'Teste sem nome',
          classe: caso.classname || suite.name || '',
          mensagem: problema.message || '(sem mensagem)',
          detalhe: (problema['#text'] ?? problema ?? '').toString().slice(0, 1000)
        });
      }
    }
  }
  return falhas;
}

let statusGeral = 'PASSOU';
let resumo = '';
let secoes = '';

for (const fonte of fontes) {
  const suites = lerSuites(fonte.arquivo);
  const falhas = extrairFalhas(suites);
  const total = suites.reduce((acc, s) => acc + Number(s?.tests ?? 0), 0);
  const passaram = Math.max(0, total - falhas.length);

  resumo += `- ${fonte.nome}: ${passaram} passaram, ${falhas.length} falharam\n`;
  secoes += `\n## ERROS_${fonte.nome}\n`;

  if (falhas.length === 0) {
    secoes += 'Nenhum erro.\n';
  } else {
    statusGeral = 'FALHOU';
    for (const f of falhas) {
      secoes += `\n### ${f.nome}\n- Classe/Arquivo: ${f.classe}\n- Mensagem: ${f.mensagem}\n- Detalhe:\n\`\`\`\n${f.detalhe}\n\`\`\`\n`;
    }
  }
}

const reportsDir = path.join(projectRoot, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const relatorioMd = `# RELATORIO_TESTES
STATUS: ${statusGeral}
DATA_EXECUCAO: ${new Date().toISOString()}

## RESUMO
${resumo}${secoes}`;

const relatorioPath = path.join(reportsDir, 'RELATORIO_TESTES.md');
fs.writeFileSync(relatorioPath, relatorioMd, 'utf-8');

console.log('==========================================================');
console.log(`  RELATÓRIO CONSOLIDADO: STATUS = ${statusGeral}`);
console.log(`  Arquivo: ${relatorioPath}`);
console.log('==========================================================');

process.exit(statusGeral === 'FALHOU' ? 1 : 0);
