import React, { useState } from 'react';
import { Upload, FileText, RefreshCcw, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { FileUploader } from './components/FileUploader';
import { SpreadsheetViewer } from './components/SpreadsheetViewer';
import { LoadingState } from './components/LoadingState';
import { projectId, publicAnonKey } from './info';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'debit' | 'credit';
  month: string;
}

interface SpreadsheetData {
  transactions: Transaction[];
  months: string[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
  };
}

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'processing' | 'spreadsheet'>('home');
  const [workflow, setWorkflow] = useState<'new' | 'update' | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleWorkflowSelect = (type: 'new' | 'update') => {
    setWorkflow(type);
    setError(null);
  };

  const handleFileUpload = async (files: FileList) => {
    if (!workflow) return;
    
    setCurrentView('processing');
    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      
      if (workflow === 'new') {
        // Para workflow 'new', agora suportamos múltiplos arquivos de extrato
        Array.from(files).forEach(file => {
          formData.append('statement', file);
        });
        formData.append('type', 'new');
      } else {
        // Para workflow 'update', mantemos a lógica existente
        Array.from(files).forEach(file => {
          formData.append('statement', file);
        });
        formData.append('type', 'update');
      }

      console.log(`Enviando ${files.length} arquivo(s) para processamento (workflow: ${workflow}):`, Array.from(files).map(f => f.name));

      const response = await fetch(`http://localhost:3000/make-server-651c9356/process-statement`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Erro no processamento do arquivo';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Validate response data structure
      if (!data || !data.transactions || !Array.isArray(data.transactions)) {
        throw new Error('Resposta inválida do servidor');
      }
      
      setSpreadsheetData(data);
      setCurrentView('spreadsheet');
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao processar arquivo';
      setError(errorMessage);
      setCurrentView('home');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async (format: 'xlsx' | 'csv') => {
    if (!spreadsheetData) return;

    try {
      const response = await fetch(`http://localhost:3000/make-server-651c9356/export-spreadsheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: spreadsheetData,
          format
        })
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao exportar planilha';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orcamento-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar arquivo';
      setError(errorMessage);
    }
  };

  const handleDownloadUpdated = async (format: 'xlsx' | 'csv') => {
    if (!spreadsheetData) return;

    try {
      const response = await fetch(`http://localhost:3000/make-server-651c9356/export-spreadsheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: spreadsheetData,
          format,
          isUpdated: true
        })
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao exportar planilha atualizada';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orcamento-atualizado-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao baixar planilha atualizada:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar planilha atualizada';
      setError(errorMessage);
    }
  };

  const resetToHome = () => {
    setCurrentView('home');
    setWorkflow(null);
    setSpreadsheetData(null);
    setError(null);
  };

  if (currentView === 'processing') {
    return <LoadingState />;
  }

  if (currentView === 'spreadsheet' && spreadsheetData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl text-gray-900 mb-2">FinanSync AI - Planilha Orçamentária</h1>
              <p className="text-gray-600">
                Transações processadas e categorizadas automaticamente
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => handleDownload('xlsx')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar XLSX
              </Button>
              <Button
                onClick={() => handleDownload('csv')}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar CSV
              </Button>
              {workflow === 'update' && (
                <Button
                  onClick={() => handleDownloadUpdated('xlsx')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Planilha Atualizada
                </Button>
              )}
              <Button onClick={resetToHome} variant="outline">
                Nova Análise
              </Button>
            </div>
          </div>

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {workflow === 'update' && (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Atualização realizada com sucesso!</strong> Use o botão "Planilha Atualizada" para baixar a versão 
                que combina os dados existentes com as novas transações, evitando duplicatas.
                <br />
                <span className="text-sm mt-2 block">
                  📊 Total de transações: {spreadsheetData.transactions.length} 
                  <span className="text-blue-600">
                    (planilha existente + novas transações)
                  </span>
                </span>
              </AlertDescription>
            </Alert>
          )}

          {workflow === 'new' && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <strong>Nova planilha criada com sucesso!</strong> A planilha foi gerada usando o template oficial 
                com todas as funcionalidades de gestão orçamentária.
                <br />
                <span className="text-sm mt-2 block">
                  📊 Total de transações: {spreadsheetData.transactions.length}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <SpreadsheetViewer 
            data={spreadsheetData} 
            onAddTransactions={(newTransactions) => {
              setSpreadsheetData(prev => ({
                ...prev,
                transactions: [...prev.transactions, ...newTransactions]
              }));
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl text-gray-900 mb-4">
            FinanSync AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Automatize Seu Orçamento em Segundos
          </p>
          <div className="bg-green-100 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-green-800 text-sm">
              🔒 Seus dados são processados com segurança e nunca são armazenados em nossos servidores após você sair.
            </p>
          </div>
        </div>

        {error && (
          <Alert className="mb-8 border-red-200 bg-red-50 max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {!workflow ? (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Criar Nova Planilha */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-300"
                  onClick={() => handleWorkflowSelect('new')}>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Criar Nova Planilha</CardTitle>
                <CardDescription className="text-gray-600">
                  Upload de múltiplos extratos bancários para gerar uma nova planilha orçamentária baseada no template oficial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Análise automática com IA
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Categorização inteligente
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Múltiplos extratos simultâneos
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Formato PDF, CSV ou TXT
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Atualizar Planilha Existente */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-300"
                  onClick={() => handleWorkflowSelect('update')}>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RefreshCcw className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Atualizar Planilha Existente</CardTitle>
                <CardDescription className="text-gray-600">
                  Adicione novas transações a uma planilha já existente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Evita duplicatas automaticamente
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Preserva dados existentes
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Merge inteligente
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <Button 
              onClick={() => setWorkflow(null)} 
              variant="outline" 
              className="mb-6"
            >
              ← Voltar
            </Button>
            
            <Card>
              <CardHeader>
                <CardTitle>
                  {workflow === 'new' ? 'Criar Nova Planilha' : 'Atualizar Planilha Existente'}
                </CardTitle>
                <CardDescription>
                  {workflow === 'new' 
                    ? 'Faça upload do seu extrato bancário (PDF, CSV ou TXT)'
                    : 'Faça upload da planilha existente e do novo extrato bancário (PDF, CSV ou TXT)'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader 
                  workflow={workflow}
                  onFileUpload={handleFileUpload}
                  disabled={processing}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* How it Works */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl text-gray-900 text-center mb-8">Como Funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg text-gray-900 mb-2">1. Upload</h3>
              <p className="text-gray-600 text-sm">
                Faça upload do seu extrato bancário em formato PDF, CSV ou TXT
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg text-gray-900 mb-2">2. Análise IA</h3>
              <p className="text-gray-600 text-sm">
                Nossa IA categoriza automaticamente todas as transações
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg text-gray-900 mb-2">3. Download</h3>
              <p className="text-gray-600 text-sm">
                Baixe sua planilha orçamentária pronta para uso
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}