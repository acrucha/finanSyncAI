import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import dotenv from "dotenv";
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const app = new Hono();

app.use('*', logger(console.log));
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Health check endpoint
app.get('/make-server-651c9356/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    gemini_configured: !!process.env.GEMINI_API_KEY
  });
});

// Categorias baseadas na planilha template
const CATEGORIES = {
  'Receita Fixa': ['salario', 'aposentadoria', 'pensao', 'aluguel recebido', 'remuneracao'],
  'Receita Variável': ['freelance', 'vendas', 'comissoes', 'premios', 'consultoria', 'projeto'],
  'Moradia': ['aluguel', 'financiamento', 'condominio', 'iptu', 'luz', 'agua', 'gas', 'internet', 'telefone', 'energia'],
  'Alimentação': ['supermercado', 'restaurante', 'delivery', 'lanche', 'ifood', 'uber eats', 'comida', 'lanchonete'],
  'Transporte': ['combustivel', 'gasolina', 'alcool', 'uber', 'taxi', '99', 'metro', 'onibus', 'estacionamento', 'posto'],
  'Saúde': ['plano de saude', 'consulta', 'medicamento', 'farmacia', 'exame', 'medico', 'hospital'],
  'Educação': ['mensalidade', 'escola', 'faculdade', 'curso', 'livro', 'universidade'],
  'Lazer': ['cinema', 'teatro', 'show', 'viagem', 'hotel', 'jogo', 'academia', 'esporte'],
  'Vestuário': ['roupa', 'calcado', 'sapato', 'tenis', 'shopping', 'loja', 'renner', 'c&a'],
  'Beleza': ['cabelereiro', 'salao', 'estetica', 'cosmetico', 'perfume'],
  'Outros Gastos': ['presente', 'doacao', 'multa', 'taxa', 'saque', 'transferencia', 'pix', 'pagamento']
};

// Função de fallback para categorização por palavras-chave
function categorizeByKeywords(description: string, amount: number): { category: string; confidence: number } {
  const lowerDesc = description.toLowerCase();
  
  console.log(`🔍 Categorizando por palavras-chave: "${description}" (valor: ${amount})`);
  
  // Se for positivo, provavelmente é receita
  if (amount > 0) {
    if (lowerDesc.includes('salario') || lowerDesc.includes('sal') || lowerDesc.includes('remuneracao')) {
      console.log(`✅ Match receita: salário -> Receita Fixa: Salário`);
      return { category: 'Receita Fixa: Salário', confidence: 0.8 };
    }
    if (lowerDesc.includes('aposentadoria') || lowerDesc.includes('inss')) {
      console.log(`✅ Match receita: aposentadoria -> Receita Fixa: Aposentadoria`);
      return { category: 'Receita Fixa: Aposentadoria', confidence: 0.8 };
    }
    if (lowerDesc.includes('aluguel') && lowerDesc.includes('recebido')) {
      console.log(`✅ Match receita: aluguel recebido -> Receita Fixa: Aluguel Recebido`);
      return { category: 'Receita Fixa: Aluguel Recebido', confidence: 0.8 };
    }
    if (lowerDesc.includes('freelance') || lowerDesc.includes('consultoria') || lowerDesc.includes('projeto')) {
      console.log(`✅ Match receita: freelance -> Receita Variável: Freelance`);
      return { category: 'Receita Variável: Freelance', confidence: 0.7 };
    }
    if (lowerDesc.includes('transferencia') && lowerDesc.includes('recebida')) {
      console.log(`✅ Match receita: transferência recebida -> Receita Variável: Outros`);
      return { category: 'Receita Variável: Outros', confidence: 0.6 };
    }
    console.log(`⚠️ Receita não reconhecida -> Receita Variável: Outros`);
    return { category: 'Receita Variável: Outros', confidence: 0.5 };
  }
  
  // Categorização para despesas - verifica cada categoria
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (category.startsWith('Receita')) continue;
    
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        const subcategory = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        console.log(`Match encontrado: "${keyword}" em "${description}" -> ${category}: ${subcategory}`);
        return { category: `${category}: ${subcategory}`, confidence: 0.7 };
      }
    }
  }
  
  // Verificações específicas para casos comuns
  if (lowerDesc.includes('transferencia') || lowerDesc.includes('pix')) {
    return { category: 'Outros Gastos: Outros', confidence: 0.3 };
  }
  if (lowerDesc.includes('pagamento') || lowerDesc.includes('debito automatico')) {
    return { category: 'Outros Gastos: Outros', confidence: 0.2 };
  }
  if (lowerDesc.includes('compra cartao')) {
    return { category: 'Outros Gastos: Outros', confidence: 0.4 };
  }
  
  console.log(`Nenhum match encontrado para: "${description}" - usando categoria padrão`);
  return { category: 'Outros Gastos: Outros', confidence: 0.3 };
}

// Função para categorizar transação usando IA
async function categorizeTransaction(description: string, amount: number): Promise<{ category: string; confidence: number }> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    console.error('GEMINI_API_KEY não configurada - usando categorização por palavras-chave');
    return categorizeByKeywords(description, amount);
  }

  console.log(`🔍 Usando Gemini para categorizar: "${description}"`);

  const prompt = `
Você é um especialista em categorização financeira brasileira. Analise esta transação bancária:

DESCRIÇÃO: "${description}"
VALOR: R$ ${Math.abs(amount).toFixed(2)}
TIPO: ${amount >= 0 ? 'RECEITA' : 'DESPESA'}

CATEGORIAS DISPONÍVEIS:
${Object.entries(CATEGORIES).map(([group, items]) => 
  `${group}: ${items.join(', ')}`
).join('\n')}

INSTRUÇÕES:
1. Analise cuidadosamente a descrição da transação
2. Considere o valor e contexto para determinar a categoria mais apropriada
3. Para receitas: use "Receita Fixa" para salários, aposentadoria, aluguel recebido; use "Receita Variável" para freelances, vendas, comissões
4. Para despesas: escolha a categoria mais específica possível
5. Se a descrição for ambígua ou genérica, use confiança baixa (0.3-0.6)
6. Se a descrição for clara e específica, use confiança alta (0.7-1.0)
7. Use os exemplos como referência, mas não se limite a eles

EXEMPLOS:
- "SALARIO EMPRESA LTDA" → Receita Fixa: Salário (confiança: 0.9)
- "SUPERMERCADO ABC" → Alimentação: Supermercado (confiança: 0.8)
- "UBER *TRIP" → Transporte: Transp. App/Taxi (confiança: 0.9)
- "NETFLIX" → Lazer: Entretenimento (confiança: 0.9)
- "IFOOD DELIVERY" → Alimentação: Delivery (confiança: 0.9)
- "PETROBRAS COMBUSTIVEL" → Transporte: Combustível (confiança: 0.9)
- "FARMACIA POPULAR" → Saúde: Farmacia (confiança: 0.9)
- "SHOPPING CENTER" → Vestuário: Compras (confiança: 0.8)
- "CONSULTA MEDICA" → Saúde: Consulta (confiança: 0.9)
- "ALUGUEL" → Moradia: Aluguel (confiança: 0.9)
- "TRANSFERENCIA" → Outros Gastos: Outros (confiança: 0.3) - precisa revisão
- "PAGAMENTO" → Outros Gastos: Outros (confiança: 0.2) - precisa revisão
- "CONSULTA MEDICA - DR. CARLOS" → Saúde: Consulta (confiança: 0.9)
- "COMPRA SUPERMERCADO" → Alimentação: Supermercado (confiança: 0.8)

Responda APENAS no formato:
Categoria: [Grupo: Item]
Confiança: [0.0-1.0]
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      console.error('Erro na API Gemini:', await response.text());
      return { category: 'Outros Gastos: Outros', confidence: 0.1 };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log(`🤖 Resposta do Gemini: ${text}`);
    
    // Parse da resposta
    const categoryMatch = text.match(/Categoria:\s*(.+)/i);
    const confidenceMatch = text.match(/Confiança:\s*([\d.]+)/i);
    
    const category = categoryMatch?.[1]?.trim() || 'Outros Gastos: Outros';
    const confidence = parseFloat(confidenceMatch?.[1] || '0.5');
    
    console.log(`✅ Gemini categorizou: "${description}" -> ${category} (confiança: ${confidence})`);
    
    return { category, confidence };
  } catch (error) {
    console.error('Erro ao categorizar transação:', error);
    console.log('Usando categorização de fallback para:', description);
    return categorizeByKeywords(description, amount);
  }
}

// Função para processar PDF usando Gemini
async function processPDF(file: File): Promise<any[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  console.log(`Processando PDF: ${file.name} (${file.size} bytes)`);

  // Converte arquivo para base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  const prompt = `
Analise este extrato bancário em PDF e extraia TODAS as transações encontradas. 
Este extrato pode ter diferentes formatos dependendo do banco (Bradesco, Itaú, Santander, Nubank, Inter, Caixa, etc).

INSTRUÇÕES ESPECÍFICAS:
1. Procure por TODAS as movimentações/transações no documento, incluindo:
   - Débitos (saídas, compras, transferências enviadas, saques, etc.)
   - Créditos (entradas, salários, transferências recebidas, depósitos, etc.)
   - PIX (enviados e recebidos)
   - Cartão de débito/crédito
   - DOCs e TEDs
   - Boletos pagos
   - Tarifas bancárias

2. Para cada transação identifique:
   - Data da transação (formato DD/MM/AAAA)
   - Descrição/Histórico COMPLETO (inclua todos os detalhes disponíveis)
   - Valor EXATO (positivo para créditos/entradas, negativo para débitos/saídas)

3. IMPORTANTE sobre valores:
   - Se o extrato mostra "- R$ 100,00" ou está em coluna de débito: use -100
   - Se o extrato mostra "+ R$ 100,00" ou está em coluna de crédito: use 100
   - Mantenha a precisão dos centavos

4. IMPORTANTE sobre descrições:
   - Mantenha o texto original do banco
   - Inclua códigos de referência se houver
   - Não abrevie ou simplifique

Responda APENAS em formato JSON válido:
{
  "transactions": [
    {
      "date": "DD/MM/AAAA",
      "description": "descrição completa exatamente como aparece",
      "amount": valor_numerico_com_sinal_correto
    }
  ]
}

EXEMPLOS de diferentes formatos de banco:
- Bradesco: "PIX TRANSFERENCIA ENVIADA CHAVE EMAIL" → valor negativo
- Itaú: "COMPRA CARTAO DEBITO SUPERMERCADO EXTRA" → valor negativo  
- Nubank: "Transferência enviada para João Silva" → valor negativo
- Santander: "SALARIO EMPRESA LTDA" → valor positivo
- Inter: "TED RECEBIDA DE MARIA SANTOS" → valor positivo

NÃO inclua:
- Saldos anteriores/posteriores
- Títulos ou cabeçalhos
- Linhas de resumo/totais
- Informações de conta

INCLUA TUDO que for movimentação financeira real.
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: file.type,
                data: base64
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Gemini:', errorText);
      throw new Error(`Erro na API Gemini: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log(`Resposta do Gemini para PDF ${file.name}:`, text.substring(0, 500) + '...');
    
    // Extrai JSON da resposta (mais robusto)
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Tenta encontrar array de transações direto
      jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const arrayData = JSON.parse(jsonMatch[0]);
        return Array.isArray(arrayData) ? arrayData : [];
      }
      throw new Error('Não foi possível extrair dados JSON da resposta do Gemini');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    const transactions = extractedData.transactions || extractedData || [];
    
    console.log(`PDF ${file.name} processado: ${transactions.length} transações extraídas`);
    
    // Valida e limpa as transações extraídas
    const validTransactions = transactions.filter((t: any) => {
      if (!t.date || !t.description || typeof t.amount !== 'number') {
        console.warn('Transação inválida ignorada:', t);
        return false;
      }
      return true;
    });

    console.log(`PDF ${file.name}: ${validTransactions.length} transações válidas de ${transactions.length} extraídas`);
    return validTransactions;
    
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    throw new Error(`Erro ao processar arquivo PDF ${file.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// Função para processar CSV
async function processCSV(csvContent: string): Promise<any[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      console.log('🔍 Usando Gemini para processar CSV...');
      const prompt = `\nAnalise este extrato bancário em CSV e extraia TODAS as transações encontradas.\nO arquivo pode ter diferentes formatos de bancos brasileiros (Bradesco, Itaú, Santander, Nubank, Inter, Caixa, etc).\n\nINSTRUÇÕES ESPECÍFICAS:\n1. Procure por TODAS as movimentações/transações no conteúdo, incluindo:\n   - Débitos (saídas, compras, transferências enviadas, saques, etc.)\n   - Créditos (entradas, salários, transferências recebidas, depósitos, etc.)\n   - PIX (enviados e recebidos)\n   - Cartão de débito/crédito\n   - DOCs e TEDs\n   - Boletos pagos\n   - Tarifas bancárias\n\n2. Para cada transação identifique:\n   - Data da transação (formato DD/MM/AAAA)\n   - Descrição/Histórico COMPLETO (inclua todos os detalhes disponíveis)\n   - Valor EXATO (positivo para créditos/entradas, negativo para débitos/saídas)\n\n3. IMPORTANTE sobre valores:\n   - Se o extrato mostra "- R$ 100,00" ou está em coluna de débito: use -100\n   - Se o extrato mostra "+ R$ 100,00" ou está em coluna de crédito: use 100\n   - Mantenha a precisão dos centavos\n\n4. IMPORTANTE sobre descrições:\n   - Mantenha o texto original do banco\n   - Inclua códigos de referência se houver\n   - Não abrevie ou simplifique\n\nResponda APENAS em formato JSON válido:\n{\n  "transactions": [\n    {\n      "date": "DD/MM/AAAA",\n      "description": "descrição completa exatamente como aparece",\n      "amount": valor_numerico_com_sinal_correto\n    }\n  ]\n}\n\nEXEMPLOS:\n- Bradesco: "PIX TRANSFERENCIA ENVIADA CHAVE EMAIL" → valor negativo\n- Itaú: "COMPRA CARTAO DEBITO SUPERMERCADO EXTRA" → valor negativo\n- Nubank: "Transferência enviada para João Silva" → valor negativo\n- Santander: "SALARIO EMPRESA LTDA" → valor positivo\n- Inter: "TED RECEBIDA DE MARIA SANTOS" → valor positivo\n\nNÃO inclua:\n- Saldos anteriores/posteriores\n- Títulos ou cabeçalhos\n- Linhas de resumo/totais\n- Informações de conta\n\nINCLUA TUDO que for movimentação financeira real.\n\nAQUI ESTÁ O CONTEÚDO DO CSV:\n\n"""\n${csvContent}\n"""\n`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na API Gemini (CSV):', errorText);
        throw new Error('Erro na API Gemini');
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Resposta do Gemini para CSV:', text.substring(0, 500) + '...');
      let jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const arrayData = JSON.parse(jsonMatch[0]);
          return Array.isArray(arrayData) ? arrayData : [];
        }
        throw new Error('Não foi possível extrair dados JSON da resposta do Gemini');
      }
      const extractedData = JSON.parse(jsonMatch[0]);
      const transactions = extractedData.transactions || extractedData || [];
      const validTransactions = transactions.filter((t: any) => {
        if (!t.date || !t.description || typeof t.amount !== 'number') {
          console.warn('Transação inválida ignorada:', t);
          return false;
        }
        return true;
      });
      console.log(`CSV processado pelo Gemini: ${validTransactions.length} transações válidas`);
      return validTransactions;
    } catch (error) {
      console.error('Erro ao processar CSV com Gemini:', error);
      // fallback para parser local
    }
  }
  // ...parser local (antigo)...
  const lines = csvContent.split('\n').filter(line => line.trim());
  const transactions: any[] = [];
  if (lines.length === 0) return transactions;
  console.log(`Processando CSV com ${lines.length} linhas`);
  console.log('Primeiras 3 linhas do CSV:', lines.slice(0, 3));
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  let separator = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    separator = ';';
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    separator = '\t';
  }
  console.log(`Separador detectado: "${separator}" (vírgulas: ${commaCount}, ponto e vírgula: ${semicolonCount}, tabs: ${tabCount})`);
  let headerRowIndex = -1;
  const headerKeywords = ['data', 'desc', 'hist', 'valor', 'quantia', 'operacao', 'tipo', 'categoria'];
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const columns = lines[i].toLowerCase().split(separator);
    const hasHeaderKeywords = columns.some(col => 
      headerKeywords.some(keyword => col.includes(keyword))
    );
    if (hasHeaderKeywords) {
      headerRowIndex = i;
      console.log(`Cabeçalho identificado na linha ${i + 1}:`, columns);
      break;
    }
  }
  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;
  console.log(`Iniciando processamento na linha ${startRow + 1}`);
  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const columns = line.split(separator).map(col => col.trim().replace(/^"|"$/g, ''));
    if (columns.length < 2) {
      console.log(`Linha ${i + 1} ignorada (poucas colunas):`, columns);
      continue;
    }
    try {
      let date = '';
      let description = '';
      let amount = 0;
      let operationType = '';
      for (let col = 0; col < Math.min(3, columns.length); col++) {
        const cellValue = columns[col];
        if (isValidDate(cellValue)) {
          date = cellValue;
          break;
        }
      }
      for (let col = columns.length - 1; col >= Math.max(columns.length - 4, 0); col--) {
        const cellValue = columns[col];
        const numericValue = parseNumericValue(cellValue);
        if (!isNaN(numericValue) && numericValue !== 0) {
          amount = numericValue;
          break;
        }
      }
      let longestText = '';
      for (let col = 1; col < columns.length - 2; col++) {
        if (columns[col] && columns[col].length > longestText.length && !isValidDate(columns[col]) && isNaN(parseFloat(columns[col].replace(/[^\d.,-]/g, '')))) {
          longestText = columns[col];
        }
      }
      description = longestText || columns[1] || 'Transação';
      for (const col of columns) {
        const lowerCol = col.toLowerCase();
        if (lowerCol.includes('debito') || lowerCol.includes('débito') || lowerCol.includes('saida')) {
          operationType = 'debit';
          break;
        } else if (lowerCol.includes('credito') || lowerCol.includes('crédito') || lowerCol.includes('entrada')) {
          operationType = 'credit';
          break;
        }
      }
      if (operationType === 'debit' && amount > 0) {
        amount = -amount;
      } else if (operationType === 'credit' && amount < 0) {
        amount = Math.abs(amount);
      } else if (!operationType) {
        operationType = amount >= 0 ? 'credit' : 'debit';
      }
      if (date && description && !isNaN(amount) && amount !== 0) {
        transactions.push({
          date: normalizeDate(date),
          description: description.trim(),
          amount: amount
        });
        console.log(`✅ Linha ${i + 1}: ${normalizeDate(date)} | ${description.trim()} | ${amount}`);
      } else {
        console.log(`⚠️ Linha ${i + 1} ignorada (dados insuficientes): data="${date}", desc="${description}", valor=${amount}`);
        console.log(`   Colunas originais:`, columns);
      }
    } catch (error) {
      console.warn(`❌ Erro na linha ${i + 1}:`, columns, error);
    }
  }
  console.log(`CSV processado: ${transactions.length} transações válidas de ${lines.length - startRow} linhas processadas`);
  return transactions;
}

// Função auxiliar para validar se uma string é uma data válida
function isValidDate(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') return false;
  
  // Padrões comuns de data
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // DD/MM/YYYY ou MM/DD/YYYY
    /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
    /^\d{1,2}-\d{1,2}-\d{4}$/, // DD-MM-YYYY
  ];

  return datePatterns.some(pattern => pattern.test(dateString.trim()));
}

// Função auxiliar para extrair valor numérico
function parseNumericValue(value: string): number {
  if (!value || typeof value !== 'string') return NaN;
  
  // Remove tudo exceto dígitos, vírgulas, pontos e sinais
  let cleanValue = value.replace(/[^\d.,-]/g, '');
  
  // Lida com diferentes formatos de número
  if (cleanValue.includes(',') && cleanValue.includes('.')) {
    // Se tem ambos, assume formato brasileiro: 1.234,56
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
  } else if (cleanValue.includes(',')) {
    // Se só tem vírgula, pode ser decimal brasileiro ou separador de milhares
    const parts = cleanValue.split(',');
    if (parts[parts.length - 1].length <= 2) {
      // Último grupo tem 2 ou menos dígitos, provavelmente decimal
      cleanValue = cleanValue.replace(/,/g, '.');
    } else {
      // Provavelmente separador de milhares
      cleanValue = cleanValue.replace(/,/g, '');
    }
  }
  
  return parseFloat(cleanValue);
}

// Função auxiliar para normalizar formato de data
function normalizeDate(dateString: string): string {
  try {
    const cleaned = dateString.trim();
    
    if (cleaned.includes('/')) {
      const parts = cleaned.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${day}/${month}/${year}`;
      }
    } else if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD -> DD/MM/YYYY
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        } else {
          // DD-MM-YYYY -> DD/MM/YYYY
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
      }
    }
    
    return cleaned;
  } catch (error) {
    console.warn('Erro ao normalizar data:', dateString, error);
    return dateString;
  }
}

// Função para converter data para mês
function getMonthFromDate(dateString: string): string {
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 
                  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  
  try {
    // Limpa a string de data
    const cleanDate = dateString.toString().trim();
    
    if (!cleanDate || cleanDate === 'undefined' || cleanDate === 'null') {
      console.warn('Data vazia ou inválida:', dateString);
      return 'JAN';
    }
    
    // Tenta vários formatos de data
    let date: Date;
    
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        // DD/MM/AAAA ou MM/DD/AAAA
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Tenta DD/MM/AAAA primeiro
        date = new Date(year, month - 1, day);
        
        // Se não funcionar, tenta MM/DD/AAAA
        if (isNaN(date.getTime()) && month <= 12) {
          date = new Date(year, day - 1, month);
        }
      } else {
        date = new Date(cleanDate);
      }
    } else if (cleanDate.includes('-')) {
      // Formato ISO ou DD-MM-AAAA
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        
        if (year > 1000) {
          // Formato ISO YYYY-MM-DD
          date = new Date(year, month - 1, day);
        } else {
          // Formato DD-MM-YYYY
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        date = new Date(cleanDate);
      }
    } else {
      // Tenta parse direto
      date = new Date(cleanDate);
    }
    
    if (isNaN(date.getTime())) {
      console.warn('Data inválida após parsing:', dateString, '->', cleanDate);
      return 'JAN'; // fallback
    }
    
    return months[date.getMonth()];
  } catch (error) {
    console.warn('Erro ao converter data:', dateString, error);
    return 'JAN';
  }
}

// Função para carregar template base
function loadTemplateBase(): any {
  try {
    const templatePath = join(process.cwd(), 'assets', 'Planilha-GestãoOrçamentária.xlsx');
    const templateBuffer = readFileSync(templatePath);
    const workbook = XLSX.read(templateBuffer, { type: 'buffer' });
    
    console.log('Template carregado com sucesso');
    return workbook;
  } catch (error) {
    console.error('Erro ao carregar template:', error);
    return null;
  }
}

// Função para ler planilha existente
async function readExistingSpreadsheet(file: File): Promise<any[]> {
  try {
    console.log(`📊 Lendo planilha existente: ${file.name} (${file.size} bytes, tipo: ${file.type})`);
    
    if (!file.name.toLowerCase().endsWith('.xlsx') && 
        !file.name.toLowerCase().endsWith('.xls') && 
        !file.name.toLowerCase().endsWith('.csv')) {
      throw new Error(`Formato de arquivo não suportado: ${file.name}. Use .xlsx, .xls ou .csv`);
    }
    
    const arrayBuffer = await file.arrayBuffer();
    console.log(`ArrayBuffer criado: ${arrayBuffer.byteLength} bytes`);
    
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'buffer',
      cellDates: false,
      cellNF: false,
      cellText: true
    });
    
    console.log('Planilha lida com sucesso. Abas encontradas:', workbook.SheetNames);
    
    // Procura pela aba "Transações" ou similar
    let sheetName = workbook.SheetNames.find(name => {
      const lowerName = name.toLowerCase();
      return lowerName.includes('transaç') || 
             lowerName.includes('transac') ||
             lowerName.includes('transaction') ||
             lowerName.includes('moviment');
    });
    
    // Se não encontrar, usa a primeira aba
    if (!sheetName) {
      sheetName = workbook.SheetNames[0];
      console.log(`⚠️ Aba "Transações" não encontrada, usando primeira aba: ${sheetName}`);
    } else {
      console.log(`✅ Usando aba: ${sheetName}`);
    }
    
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Não foi possível acessar a aba: ${sheetName}`);
    }
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      defval: '',
      blankrows: false
    });
    
    console.log(`📋 Planilha tem ${jsonData.length} linhas (incluindo possível cabeçalho)`);
    
    if (jsonData.length === 0) {
      console.warn('⚠️ Planilha está vazia');
      return [];
    }
    
    // Log das primeiras linhas para debug
    console.log('🔍 Primeiras 3 linhas da planilha:');
    jsonData.slice(0, 3).forEach((row, i) => {
      console.log(`  Linha ${i + 1}:`, row);
    });
    
    const transactions: any[] = [];
    
    // Identifica o cabeçalho automaticamente
    let headerRow = 0;
    const headerKeywords = ['data', 'descriç', 'valor', 'categoria', 'tipo', 'mes', 'month'];
    
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (row && Array.isArray(row)) {
        const hasHeaderKeywords = row.some(cell => {
          if (cell && typeof cell === 'string') {
            const lowerCell = cell.toLowerCase();
            return headerKeywords.some(keyword => lowerCell.includes(keyword));
          }
          return false;
        });
        
        if (hasHeaderKeywords) {
          headerRow = i;
          console.log(`📋 Cabeçalho identificado na linha ${headerRow + 1}:`, row);
          break;
        }
      }
    }
    
    if (headerRow === jsonData.length - 1) {
      console.warn('⚠️ Só foi encontrado cabeçalho, sem dados de transações');
      return [];
    }
    
    // Processa as linhas após o cabeçalho
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      
      if (!row || !Array.isArray(row) || row.length < 3) {
        continue;
      }
      
      // Verifica se a linha tem pelo menos algum conteúdo
      if (!row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
        continue;
      }
      
      try {
        const date = row[0]?.toString().trim() || '';
        const description = row[1]?.toString().trim() || '';
        const category = row[2]?.toString().trim() || '';
        const amountStr = row[3]?.toString() || '0';
        
        // Parse do valor mais robusto
        let amount = 0;
        if (amountStr) {
          const cleanAmount = amountStr.replace(/[^\d.,-]/g, '').replace(',', '.');
          amount = parseFloat(cleanAmount);
        }
        
        const type = row[4]?.toString().trim() || (amount >= 0 ? 'credit' : 'debit');
        const month = row[5]?.toString().trim() || getMonthFromDate(date);
        
        if (date && description && !isNaN(amount) && amount !== 0) {
          const transaction = {
            id: `${date}-${description}-${amount}`.replace(/[^a-zA-Z0-9]/g, ''),
            date,
            description,
            amount,
            category: category || 'Outros Gastos: Outros',
            type: type.toLowerCase().includes('credit') || type.toLowerCase().includes('receita') ? 'credit' : 'debit',
            month,
            confidence: 1 // Dados existentes têm confiança máxima
          };
          
          transactions.push(transaction);
          processedCount++;
          
          if (processedCount <= 5) { // Log das primeiras 5 transações
            console.log(`✅ Transação ${processedCount}: ${date} | ${description} | R$ ${amount}`);
          }
        } else {
          errorCount++;
          if (errorCount <= 3) { // Log dos primeiros 3 erros
            console.log(`⚠️ Linha ${i + 1} ignorada - data:"${date}", desc:"${description}", valor:${amount}, isNaN:${isNaN(amount)}`);
          }
        }
      } catch (error) {
        errorCount++;
        console.warn(`❌ Erro ao processar linha ${i + 1}:`, row, error);
      }
    }
    
    console.log(`📊 Resultado da leitura: ${transactions.length} transações válidas (${processedCount} processadas, ${errorCount} erros)`);
    
    if (transactions.length === 0) {
      throw new Error('Nenhuma transação válida foi encontrada na planilha. Verifique se os dados estão no formato correto.');
    }
    
    return transactions;
    
  } catch (error) {
    console.error('❌ Erro ao ler planilha existente:', error);
    
    if (error instanceof Error) {
      throw new Error(`Erro ao processar planilha ${file.name}: ${error.message}`);
    } else {
      throw new Error(`Erro desconhecido ao processar planilha ${file.name}`);
    }
  }
}

// Rota principal para processar extratos
app.post('/make-server-651c9356/process-statement', async (c) => {
  try {
    console.log('Iniciando processamento de extrato(s)...');
    
    const formData = await c.req.formData();
    const type = formData.get('type') as string;
    
    // Coleta todos os arquivos enviados e os separa em extratos e planilha existente
    const statementFiles: File[] = [];
    let existingSpreadsheet: File | null = null;
    
    for (const [key, value] of formData.entries()) {
      if (key === 'statement' && value instanceof File) {
        console.log(`Analisando arquivo: ${value.name} (tipo: ${value.type}, tamanho: ${value.size})`);
        
        // Verifica se é uma planilha existente ou extrato
        const isXlsx = value.name.toLowerCase().endsWith('.xlsx') || value.name.toLowerCase().endsWith('.xls');
        const isExcelMime = value.type.includes('spreadsheet') || value.type.includes('excel');
        const isCsvSpreadsheet = value.name.toLowerCase().endsWith('.csv') && value.size > 50000; // CSV grande provavelmente é planilha
        
        if (isXlsx || isExcelMime || isCsvSpreadsheet) {
          if (!existingSpreadsheet) {
            existingSpreadsheet = value;
            console.log(`✅ Planilha existente identificada: ${value.name}`);
          } else {
            console.log(`⚠️ Segunda planilha ignorada: ${value.name} (já temos: ${existingSpreadsheet.name})`);
          }
        } else {
          statementFiles.push(value);
          console.log(`✅ Extrato identificado: ${value.name}`);
        }
      }
    }
    
    if (statementFiles.length === 0) {
      console.error('Nenhum arquivo de extrato fornecido');
      return c.json({ error: 'Pelo menos um arquivo de extrato é obrigatório' }, 400);
    }

    console.log(`Processando ${statementFiles.length} arquivo(s):`, statementFiles.map(f => f.name));

    // Processa todos os arquivos de extrato
    let allRawTransactions: any[] = [];
    
    for (const statementFile of statementFiles) {
      try {
        console.log(`\n🔄 Processando arquivo: ${statementFile.name} (${statementFile.size} bytes)`);
        
        let rawTransactions: any[] = [];
        
        if (statementFile.type === 'application/pdf') {
          console.log('📄 Processando arquivo PDF...');
          rawTransactions = await processPDF(statementFile);
        } else if (
          statementFile.type === 'text/csv' || statementFile.name.endsWith('.csv') ||
          statementFile.type === 'text/plain' || statementFile.name.endsWith('.txt')
        ) {
          // Trata TXT como extrato textual, usando Gemini para extrair transações
          const isTxt = statementFile.type === 'text/plain' || statementFile.name.endsWith('.txt');
          const label = isTxt ? 'TXT' : 'CSV';
          console.log(`📊 Processando arquivo ${label}...`);
          const content = await statementFile.text();
          console.log(`${label} tem ${content.length} caracteres`);
          if (isTxt) {
            // Usa Gemini para processar TXT como extrato
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (geminiApiKey) {
              try {
                const prompt = `\nAnalise este extrato bancário em texto e extraia TODAS as transações encontradas.\nO arquivo pode ter diferentes formatos de bancos brasileiros (Bradesco, Itaú, Santander, Nubank, Inter, Caixa, etc).\n\nINSTRUÇÕES ESPECÍFICAS:\n1. Procure por TODAS as movimentações/transações no conteúdo, incluindo:\n   - Débitos (saídas, compras, transferências enviadas, saques, etc.)\n   - Créditos (entradas, salários, transferências recebidas, depósitos, etc.)\n   - PIX (enviados e recebidos)\n   - Cartão de débito/crédito\n   - DOCs e TEDs\n   - Boletos pagos\n   - Tarifas bancárias\n\n2. Para cada transação identifique:\n   - Data da transação (formato DD/MM/AAAA)\n   - Descrição/Histórico COMPLETO (inclua todos os detalhes disponíveis)\n   - Valor EXATO (positivo para créditos/entradas, negativo para débitos/saídas)\n\n3. IMPORTANTE sobre valores:\n   - Se o extrato mostra "- R$ 100,00" ou está em coluna de débito: use -100\n   - Se o extrato mostra "+ R$ 100,00" ou está em coluna de crédito: use 100\n   - Mantenha a precisão dos centavos\n\n4. IMPORTANTE sobre descrições:\n   - Mantenha o texto original do banco\n   - Inclua códigos de referência se houver\n   - Não abrevie ou simplifique\n\nResponda APENAS em formato JSON válido:\n{\n  "transactions": [\n    {\n      "date": "DD/MM/AAAA",\n      "description": "descrição completa exatamente como aparece",\n      "amount": valor_numerico_com_sinal_correto\n    }\n  ]\n}\n\nEXEMPLOS:\n- Bradesco: "PIX TRANSFERENCIA ENVIADA CHAVE EMAIL" → valor negativo\n- Itaú: "COMPRA CARTAO DEBITO SUPERMERCADO EXTRA" → valor negativo\n- Nubank: "Transferência enviada para João Silva" → valor negativo\n- Santander: "SALARIO EMPRESA LTDA" → valor positivo\n- Inter: "TED RECEBIDA DE MARIA SANTOS" → valor positivo\n\nNÃO inclua:\n- Saldos anteriores/posteriores\n- Títulos ou cabeçalhos\n- Linhas de resumo/totais\n- Informações de conta\n\nINCLUA TUDO que for movimentação financeira real.\n\nAQUI ESTÁ O CONTEÚDO DO EXTRATO EM TEXTO:\n\n"""\n${content}\n"""\n`;
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                  })
                });
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Erro na API Gemini (TXT):', errorText);
                  throw new Error('Erro na API Gemini');
                }
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                console.log('Resposta do Gemini para TXT:', text.substring(0, 500) + '...');
                let jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                  jsonMatch = text.match(/\[[\s\S]*\]/);
                  if (jsonMatch) {
                    const arrayData = JSON.parse(jsonMatch[0]);
                    rawTransactions = Array.isArray(arrayData) ? arrayData : [];
                  } else {
                    throw new Error('Não foi possível extrair dados JSON da resposta do Gemini');
                  }
                } else {
                  const extractedData = JSON.parse(jsonMatch[0]);
                  const transactions = extractedData.transactions || extractedData || [];
                  rawTransactions = transactions.filter((t: any) => {
                    if (!t.date || !t.description || typeof t.amount !== 'number') {
                      console.warn('Transação inválida ignorada:', t);
                      return false;
                    }
                    return true;
                  });
                }
                console.log(`TXT processado pelo Gemini: ${rawTransactions.length} transações válidas`);
              } catch (error) {
                console.error('Erro ao processar TXT com Gemini:', error);
                rawTransactions = [];
              }
            } else {
              console.warn('GEMINI_API_KEY não configurada. Não é possível processar TXT.');
              rawTransactions = [];
            }
          } else {
            // CSV normal
            rawTransactions = await processCSV(content);
          }
        } else {
          console.warn(`⚠️ Formato de arquivo não suportado ignorado: ${statementFile.type} (${statementFile.name})`);
          continue;
        }
        
        console.log(`✅ Arquivo ${statementFile.name}: ${rawTransactions.length} transações extraídas`);
        
        // Log das primeiras transações para debug
        if (rawTransactions.length > 0) {
          console.log('📋 Primeiras 3 transações extraídas:');
          rawTransactions.slice(0, 3).forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.date} | ${t.description} | R$ ${t.amount}`);
          });
        }
        
        allRawTransactions.push(...rawTransactions);
        
      } catch (fileError) {
        console.error(`❌ Erro ao processar arquivo ${statementFile.name}:`, fileError);
        // Continua com os outros arquivos em vez de falhar completamente
      }
    }

    console.log(`\n📊 RESUMO: Total de ${allRawTransactions.length} transações brutas extraídas de ${statementFiles.length} arquivo(s)`);
    
    if (allRawTransactions.length === 0) {
      console.warn('⚠️ Nenhuma transação foi extraída dos arquivos fornecidos');
      return c.json({ 
        error: 'Nenhuma transação foi encontrada nos arquivos fornecidos. Verifique se os arquivos contêm extratos válidos.',
        transactions: [],
        months: [],
        summary: { totalIncome: 0, totalExpenses: 0, balance: 0 }
      }, 400);
    }

    // Se for atualização, carrega dados existentes
    let existingTransactions: any[] = [];
    if (type === 'update') {
      // Primeiro tenta usar a planilha enviada junto com os extratos
      if (existingSpreadsheet) {
        console.log('Carregando planilha existente enviada:', existingSpreadsheet.name);
        try {
          existingTransactions = await readExistingSpreadsheet(existingSpreadsheet);
          console.log(`Carregadas ${existingTransactions.length} transações da planilha existente`);
        } catch (error) {
          console.error('Erro ao carregar planilha existente enviada:', error);
        }
      } else {
        // Fallback para o método antigo (campo 'existing' separado)
        const existingFile = formData.get('existing') as File;
        if (existingFile) {
          console.log('Carregando planilha existente (método antigo):', existingFile.name);
          try {
            existingTransactions = await readExistingSpreadsheet(existingFile);
            console.log(`Carregadas ${existingTransactions.length} transações existentes`);
          } catch (error) {
            console.error('Erro ao carregar planilha existente:', error);
          }
        } else {
          console.log('Nenhuma planilha existente fornecida - criando planilha nova');
        }
      }
    }

    // Processa e categoriza transações
    console.log(`\n🤖 Iniciando categorização de ${allRawTransactions.length} transações...`);
    const processedTransactions = [];
    const months = new Set<string>();
    let categorizedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < allRawTransactions.length; i++) {
      const rawTransaction = allRawTransactions[i];
      
      try {
        console.log(`\n📝 Categorizando transação ${i + 1}/${allRawTransactions.length}:`);
        console.log(`   Data: "${rawTransaction.date}" | Descrição: "${rawTransaction.description}" | Valor: R$ ${rawTransaction.amount}`);
        
        // Categoriza a transação
        const { category, confidence } = await categorizeTransaction(
          rawTransaction.description, 
          rawTransaction.amount
        );
        
        console.log(`   ✅ Resultado: ${category} (confiança: ${confidence})`);
        categorizedCount++;
        
        const month = getMonthFromDate(rawTransaction.date);
        months.add(month);
        
        const transaction = {
          id: `${rawTransaction.date}-${rawTransaction.description}-${rawTransaction.amount}`.replace(/[^a-zA-Z0-9]/g, ''),
          date: rawTransaction.date,
          description: rawTransaction.description,
          amount: rawTransaction.amount,
          category: category || 'Outros Gastos: Outros',
          type: rawTransaction.amount >= 0 ? 'credit' : 'debit',
          month,
          confidence: confidence || 0.5
        };
        
        // Verifica duplicatas apenas se for update
        if (type === 'update') {
          const isDuplicate = existingTransactions.some(existing => 
            existing.date === transaction.date &&
            existing.description === transaction.description &&
            Math.abs(existing.amount - transaction.amount) < 0.01
          );
          
          if (!isDuplicate) {
            processedTransactions.push(transaction);
            console.log(`   💾 Transação adicionada à planilha`);
          } else {
            duplicateCount++;
            console.log(`   🔄 Transação duplicada ignorada`);
          }
        } else {
          processedTransactions.push(transaction);
          console.log(`   💾 Transação adicionada à planilha`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Erro ao processar transação ${i + 1}:`, rawTransaction, error);
        
        // Tenta adicionar a transação mesmo com erro na categorização
        try {
          const month = getMonthFromDate(rawTransaction.date);
          months.add(month);
          
          const fallbackTransaction = {
            id: `${rawTransaction.date}-${rawTransaction.description}-${rawTransaction.amount}`.replace(/[^a-zA-Z0-9]/g, ''),
            date: rawTransaction.date,
            description: rawTransaction.description,
            amount: rawTransaction.amount,
            category: 'Outros Gastos: Outros',
            type: rawTransaction.amount >= 0 ? 'credit' : 'debit',
            month,
            confidence: 0.1
          };
          
          processedTransactions.push(fallbackTransaction);
          console.log(`   🆘 Transação adicionada com categoria padrão`);
        } catch (fallbackError) {
          console.error(`   💥 Falha total na transação ${i + 1}:`, fallbackError);
        }
      }
    }

    console.log(`\n📊 RESULTADO DA CATEGORIZAÇÃO:`);
    console.log(`   ✅ ${categorizedCount} transações categorizadas com sucesso`);
    console.log(`   🔄 ${duplicateCount} duplicatas ignoradas`);
    console.log(`   ❌ ${errorCount} erros de categorização`);
    console.log(`   💾 ${processedTransactions.length} transações finais processadas`);

    if (processedTransactions.length === 0) {
      console.warn('⚠️ Nenhuma transação foi processada com sucesso');
      return c.json({ 
        error: 'Nenhuma transação foi processada com sucesso. Verifique os logs para mais detalhes.',
        transactions: [],
        months: [],
        summary: { totalIncome: 0, totalExpenses: 0, balance: 0 }
      }, 400);
    }

    console.log('Transações processadas de todos os arquivos:', processedTransactions.length);

    // Combina transações existentes com novas (se for update)
    let allTransactions = [...existingTransactions];
    
    if (type === 'update') {
      // Para atualização, adiciona apenas as novas transações não duplicadas
      allTransactions = [...existingTransactions, ...processedTransactions];
    } else {
      // Para nova planilha, usa apenas as transações processadas
      allTransactions = processedTransactions;
    }

    // Atualiza meses com base em todas as transações
    const allMonths = new Set<string>();
    allTransactions.forEach(t => allMonths.add(t.month));

    // Calcula resumo com todas as transações
    const totalIncome = allTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = allTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Para o frontend, retornamos apenas as novas transações processadas
    // O frontend já tem as transações existentes e vai combinar elas
    const result = {
      transactions: processedTransactions, // Apenas as novas transações
      months: Array.from(allMonths).sort(),
      summary: {
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses
      }
    };

    console.log(`Processamento concluído com sucesso. Arquivos processados: ${statementFiles.length}, Novas transações: ${processedTransactions.length}`);
    if (existingTransactions.length > 0) {
      console.log(`Total geral: ${allTransactions.length} transações (${existingTransactions.length} existentes + ${processedTransactions.length} novas)`);
    }

    return c.json(result);
  } catch (error) {
    console.error('Erro ao processar extrato:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no servidor';
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return c.json({ 
      error: `Erro no processamento: ${errorMessage}` 
    }, 500);
  }
});

// Rota para exportar planilha
app.post('/make-server-651c9356/export-spreadsheet', async (c) => {
  try {
    const { data, format, isUpdated } = await c.req.json();
    
    if (format === 'csv') {
      // Gera CSV
      const csvContent = [
        'Data,Descrição,Categoria,Valor,Tipo,Mês',
        ...data.transactions.map((t: any) => 
          `${t.date},"${t.description}","${t.category}",${t.amount},${t.type},${t.month}`
        )
      ].join('\n');
      
      const filename = isUpdated ? 'orcamento-atualizado.csv' : 'orcamento.csv';
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } else if (format === 'xlsx') {
      // Carrega template base para novas planilhas
      let workbook;
      
      if (isUpdated) {
        // Para planilhas atualizadas, cria nova
        workbook = XLSX.utils.book_new();
      } else {
        // Para novas planilhas, usa o template
        workbook = loadTemplateBase();
        if (!workbook) {
          // Fallback se não conseguir carregar template
          workbook = XLSX.utils.book_new();
        }
      }
      
      // Dados das transações
      const transactionsData = data.transactions.map((t: any) => ({
        Data: t.date,
        Descrição: t.description,
        Categoria: t.category,
        Valor: t.amount,
        Tipo: t.type === 'credit' ? 'Receita' : 'Despesa',
        Mês: t.month
      }));
      
      // Se for template, adiciona os dados na aba existente ou cria nova
      if (isUpdated || !workbook.SheetNames.includes('Transações')) {
        const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transações');
      } else {
        // Para template, adiciona os dados na aba existente
        const existingSheet = workbook.Sheets['Transações'];
        const existingData = XLSX.utils.sheet_to_json(existingSheet, { header: 1 });
        
        // Encontra a primeira linha vazia após o cabeçalho
        let startRow = 1;
        while (startRow < existingData.length && existingData[startRow] && Array.isArray(existingData[startRow]) && (existingData[startRow] as any[]).some((cell: any) => cell !== null && cell !== undefined && cell !== '')) {
          startRow++;
        }
        
        // Adiciona as novas transações
        transactionsData.forEach((transaction, index) => {
          const row = startRow + index;
          XLSX.utils.sheet_add_aoa(existingSheet, [
            [transaction.Data, transaction.Descrição, transaction.Categoria, transaction.Valor, transaction.Tipo, transaction.Mês]
          ], { origin: `A${row + 1}` });
        });
      }
      
      // Resumo - sempre adiciona/atualiza
      const summaryData = [
        { Métrica: 'Receitas Totais', Valor: data.summary.totalIncome },
        { Métrica: 'Gastos Totais', Valor: data.summary.totalExpenses },
        { Métrica: 'Saldo', Valor: data.summary.balance }
      ];
      
      if (workbook.SheetNames.includes('Resumo')) {
        // Atualiza aba existente
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        workbook.Sheets['Resumo'] = summarySheet;
      } else {
        // Cria nova aba
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
      }
      
      // Gera o buffer do arquivo
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      const filename = isUpdated ? 'orcamento-atualizado.xlsx' : 'orcamento.xlsx';
      
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } else {
      return c.json({ error: 'Formato não suportado. Use "csv" ou "xlsx".' }, 400);
    }
  } catch (error) {
    console.error('Erro ao exportar planilha:', error);
    return c.json({ error: 'Erro ao exportar planilha' }, 500);
  }
});

serve({ fetch: app.fetch });