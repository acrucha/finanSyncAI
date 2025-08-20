# 🤖 FinanSync AI - Automação Financeira

Uma aplicação de automação financeira que utiliza Inteligência Artificial para processar extratos bancários e gerar planilhas orçamentárias organizadas automaticamente.

## 🎯 Características

- 📄 **Processamento de Extratos**: Suporte para PDF e CSV de múltiplos bancos
- 🤖 **IA Integrada**: Categorização automática de transações usando Google Gemini
- 📊 **Múltiplos Formatos**: Importação e exportação em XLSX e CSV
- 🔄 **Atualização Inteligente**: Adicione novos extratos a planilhas existentes evitando duplicatas
- 💰 **Análise Completa**: Resumos financeiros, categorização por mês e relatórios consolidados
- 🎨 **Interface Moderna**: Interface intuitiva com React e Tailwind CSS

## 🛠️ Tecnologias

### Frontend
- **React 19** - Biblioteca de interface de usuário
- **TypeScript** - Tipagem estática
- **Vite** - Bundler e dev server
- **Tailwind CSS** - Framework de CSS utilitário
- **Radix UI** - Componentes de interface acessíveis
- **Lucide React** - Ícones

### Backend
- **Hono.js** - Framework web rápido
- **Node.js** - Runtime JavaScript
- **XLSX** - Manipulação de planilhas Excel
- **Google Gemini API** - Inteligência Artificial para categorização

## 📋 Pré-requisitos

- **Node.js** 18 ou superior
- **npm** ou **yarn**
- **Chave do Google Gemini API** ([obter aqui](https://ai.google.dev/gemini-api))

## 🚀 Instalação e Configuração

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd "Sincronia Financeira IA - Automação Financeira"
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env e adicione sua chave do Gemini
GEMINI_API_KEY=sua_chave_do_gemini_aqui
```

## 🎮 Como Executar

### Desenvolvimento (Recomendado)

Para executar em modo de desenvolvimento com hot-reload:

```bash
# Terminal 1 - Frontend (Vite)
npm run dev

# Terminal 2 - Backend (Hono Server)
npm run server:dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

### Produção

```bash
# Compilar o projeto
npm run build

# Executar servidor backend
npm run server

# Executar preview do frontend
npm run preview
```

## 📁 Estrutura do Projeto

```
├── client/                 # Frontend React
│   ├── components/        # Componentes React
│   │   ├── ui/           # Componentes de interface base
│   │   ├── FileUploader.tsx
│   │   ├── SpreadsheetViewer.tsx
│   │   └── LoadingState.tsx
│   ├── styles/           # Estilos CSS
│   └── App.tsx          # Componente principal
├── server/               # Backend Hono.js
│   └── index.tsx        # Servidor principal
├── assets/              # Recursos e documentação
├── package.json         # Dependências e scripts
├── vite.config.ts       # Configuração do Vite
├── tailwind.config.js   # Configuração do Tailwind
└── tsconfig.json        # Configuração do TypeScript
```

## 🎯 Como Usar

### 1. Criar Nova Planilha
1. Selecione "Criar Nova Planilha"
2. Faça upload de um ou múltiplos extratos bancários (PDF ou CSV)
3. Aguarde a IA processar e categorizar as transações
4. Baixe sua planilha orçamentária organizada

### 2. Atualizar Planilha Existente
1. Selecione "Atualizar Planilha Existente"
2. Faça upload dos novos extratos
3. (Opcional) Upload da planilha existente para evitar duplicatas
4. A IA adicionará apenas as novas transações

### 3. Formatos Suportados
- **Entrada**: PDF, CSV (múltiplos bancos brasileiros)
- **Saída**: XLSX (Excel), CSV

## 🏦 Bancos Suportados

- Bradesco
- Itaú
- Santander
- Nubank
- Inter
- Caixa Econômica Federal
- E outros formatos CSV padrão

## 📊 Scripts Disponíveis

```bash
npm run dev          # Inicia frontend em modo desenvolvimento
npm run build        # Compila o projeto para produção
npm run preview      # Preview da build de produção
npm run start        # Alias para preview
npm run server       # Inicia o servidor backend
npm run server:dev   # Inicia backend em modo desenvolvimento
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente

```bash
# .env
GEMINI_API_KEY=sua_chave_aqui    # Obrigatório - Chave do Google Gemini
```

### Personalização de Categorias

As categorias podem ser ajustadas no arquivo `server/index.tsx` na constante `CATEGORIES`.

## 🚨 Solução de Problemas

### Erro "GEMINI_API_KEY not found"
- Verifique se criou o arquivo `.env`
- Certifique-se que a chave está correta
- Reinicie o servidor backend

### Erro de CORS
- Certifique-se que o backend está rodando na porta 3000
- Verifique se não há outros serviços usando as portas

### Upload falha
- Verifique o formato do arquivo (PDF ou CSV)
- Certifique-se que o arquivo não está corrompido
- Teste com um arquivo menor primeiro

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

Feito com ❤️ para automatizar suas finanças pessoais!