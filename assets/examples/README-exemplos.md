# Exemplos de Extratos Bancários

Esta pasta contém exemplos de extratos bancários em diferentes formatos para testar o sistema FinanSync AI.

## 📁 Arquivos de Exemplo

### 1. **extrato-nubank-exemplo.csv**
- **Banco**: Nubank
- **Formato**: CSV com vírgula
- **Colunas**: Data, Descrição, Valor
- **Características**: Valores negativos para débitos, positivos para créditos

### 2. **extrato-itau-exemplo.csv**
- **Banco**: Itaú
- **Formato**: CSV com vírgula
- **Colunas**: Data, Histórico, Valor, Tipo
- **Características**: Coluna adicional "Tipo" (CREDITO/DEBITO)

### 3. **extrato-bradesco-exemplo.csv**
- **Banco**: Bradesco
- **Formato**: CSV com vírgula
- **Colunas**: Data, Descrição, Valor, Saldo
- **Características**: Inclui saldo após cada transação

### 4. **extrato-santander-exemplo.csv**
- **Banco**: Santander
- **Formato**: CSV com vírgula
- **Colunas**: Data, Descrição, Valor, Operação
- **Características**: Coluna "Operação" (CREDITO/DEBITO)

### 5. **extrato-caixa-exemplo.csv**
- **Banco**: Caixa Econômica
- **Formato**: CSV com vírgula
- **Colunas**: Data, Histórico, Valor, Saldo Atual
- **Características**: Saldo atualizado após cada transação

### 6. **extrato-inter-exemplo.csv**
- **Banco**: Inter
- **Formato**: CSV com ponto e vírgula
- **Colunas**: Data; Descrição; Valor; Tipo
- **Características**: Separador diferente (ponto e vírgula)

### 7. **extrato-simples-exemplo.csv**
- **Banco**: Genérico
- **Formato**: CSV com vírgula
- **Colunas**: Data, Descrição, Valor
- **Características**: Formato mais simples, apenas 3 colunas

## 🧪 Como Testar

1. **Faça upload** de qualquer um dos arquivos CSV
2. **Escolha** o workflow "Criar Nova Planilha" ou "Atualizar Planilha"
3. **Observe** como o sistema processa diferentes formatos
4. **Verifique** a categorização automática das transações

## 📊 Tipos de Transações Incluídas

### Receitas:
- Salários
- Aposentadoria
- Transferências recebidas
- Freelance/Consultoria
- Aluguel recebido

### Despesas:
- Supermercado
- Transporte (Uber, combustível)
- Entretenimento (Netflix, cinema)
- Alimentação (iFood, restaurantes)
- Saúde (consultas, farmácia)
- Moradia (aluguel, condomínio)
- Serviços (internet, telefone)
- Compras (shopping, roupas)

## 🔧 Formatação dos Dados

- **Datas**: DD/MM/AAAA
- **Valores**: Números decimais com ponto (ex: 150.50)
- **Débitos**: Valores negativos ou coluna "Tipo" = DEBITO
- **Créditos**: Valores positivos ou coluna "Tipo" = CREDITO

## 💡 Dicas de Uso

- Use estes exemplos para testar a robustez do sistema
- Compare como diferentes formatos são processados
- Verifique a precisão da categorização automática
- Teste a funcionalidade de atualização de planilhas existentes 