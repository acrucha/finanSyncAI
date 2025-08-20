import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertTriangle, TrendingUp, TrendingDown, Plus, Edit, Trash2, Upload } from 'lucide-react';
import { env } from '../public/env'; // Importa a variável de ambiente gerada

const SERVER_URL = env.SERVER_URL || 'localhost:3000';
console.log(`Server URL: ${SERVER_URL}`);

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'debit' | 'credit';
  month: string;
  confidence?: number;
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

interface SpreadsheetViewerProps {
  data: SpreadsheetData;
  onAddTransactions?: (newTransactions: Transaction[]) => void;
}

interface EditTransactionData {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'debit' | 'credit';
}

const CATEGORIES = {
  'Receita Fixa': ['Salário', 'Aposentadoria', 'Pensão', 'Aluguel Recebido', 'Outros'],
  'Receita Variável': ['Freelance', 'Vendas', 'Comissões', 'Prêmios', 'Outros'],
  'Moradia': ['Aluguel', 'Financiamento', 'Condomínio', 'IPTU', 'Luz', 'Água', 'Gás', 'Internet', 'Telefone', 'Outros'],
  'Alimentação': ['Supermercado', 'Restaurante', 'Delivery', 'Lanche', 'Outros'],
  'Transporte': ['Combustível', 'Transp. Público', 'Transp. App/Taxi', 'Estacionamento', 'Manutenção Veículo', 'Outros'],
  'Saúde': ['Plano de Saúde', 'Consultas', 'Medicamentos', 'Exames', 'Outros'],
  'Educação': ['Mensalidade', 'Material Escolar', 'Cursos', 'Livros', 'Outros'],
  'Lazer': ['Cinema', 'Teatro', 'Shows', 'Viagens', 'Jogos', 'Outros'],
  'Vestuário': ['Roupas', 'Calçados', 'Acessórios', 'Outros'],
  'Beleza': ['Cabelereiro', 'Estética', 'Cosméticos', 'Outros'],
  'Outros Gastos': ['Presentes', 'Doações', 'Multas', 'Taxas', 'Outros']
};

export function SpreadsheetViewer({ data, onAddTransactions }: SpreadsheetViewerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(data.transactions);
  const [activeMonth, setActiveMonth] = useState(data.months[0] || 'JAN');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EditTransactionData | null>(null);
  const [isUploadingStatement, setIsUploadingStatement] = useState(false);
  const [newTransaction, setNewTransaction] = useState<EditTransactionData>({
    id: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: 'Outros Gastos: Outros',
    type: 'debit'
  });

  const updateTransactionCategory = (transactionId: string, newCategory: string) => {
    console.log(`Atualizando categoria: ${transactionId} -> ${newCategory}`);
    setTransactions(prev => 
      prev.map(t => 
        t.id === transactionId 
          ? { ...t, category: newCategory, confidence: 1 }
          : t
      )
    );
  };

  const addTransaction = () => {
    if (!newTransaction.description || newTransaction.amount === 0) return;
    
    const transaction: Transaction = {
      id: `${newTransaction.date}-${newTransaction.description}-${newTransaction.amount}`.replace(/[^a-zA-Z0-9]/g, ''),
      date: newTransaction.date,
      description: newTransaction.description,
      amount: newTransaction.type === 'debit' ? -Math.abs(newTransaction.amount) : Math.abs(newTransaction.amount),
      category: newTransaction.category,
      type: newTransaction.type,
      month: getMonthFromDate(newTransaction.date),
      confidence: 1
    };
    
    setTransactions(prev => [...prev, transaction]);
    setNewTransaction({
      id: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0,
      category: 'Outros Gastos: Outros',
      type: 'debit'
    });
    setIsAddDialogOpen(false);
  };

  const editTransaction = () => {
    if (!editingTransaction || !editingTransaction.description || editingTransaction.amount === 0) return;
    
    setTransactions(prev => 
      prev.map(t => 
        t.id === editingTransaction.id 
          ? {
              ...t,
              date: editingTransaction.date,
              description: editingTransaction.description,
              amount: editingTransaction.type === 'debit' ? -Math.abs(editingTransaction.amount) : Math.abs(editingTransaction.amount),
              category: editingTransaction.category,
              type: editingTransaction.type,
              month: getMonthFromDate(editingTransaction.date),
              confidence: 1
            }
          : t
      )
    );
    
    setEditingTransaction(null);
    setIsEditDialogOpen(false);
  };

  const deleteTransaction = (transactionId: string) => {
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      amount: Math.abs(transaction.amount),
      category: transaction.category,
      type: transaction.type
    });
    setIsEditDialogOpen(true);
  };

  const getMonthFromDate = (dateString: string): string => {
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    try {
      const date = new Date(dateString);
      return months[date.getMonth()];
    } catch {
      return 'JAN';
    }
  };

  const handleUploadStatement = async (files: FileList) => {
    setIsUploadingStatement(true);
    try {
      const formData = new FormData();
      
      // Adiciona todos os arquivos com a chave 'statement'
      Array.from(files).forEach(file => {
        formData.append('statement', file);
      });
      
      formData.append('type', 'update');

      console.log(`Enviando ${files.length} arquivo(s) para processamento:`, Array.from(files).map(f => f.name));

      const response = await fetch(`http://${SERVER_URL}/make-server-651c9356/process-statement`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar extratos');
      }

      const result = await response.json();
      
      console.log(`Processamento concluído: ${result.transactions.length} novas transações`);
      
      // Adiciona todas as novas transações à lista existente
      setTransactions(prev => [...prev, ...result.transactions]);
      
      // Notifica o componente pai se necessário
      if (onAddTransactions) {
        onAddTransactions(result.transactions);
      }
      
      // Mostra resumo do processamento
      if (result.transactions.length > 0) {
        const income = result.transactions.filter((t: any) => t.type === 'credit').length;
        const expenses = result.transactions.filter((t: any) => t.type === 'debit').length;
        alert(`✅ Processamento concluído!\n\n📊 Resumo:\n• ${result.transactions.length} transações adicionadas\n• ${income} receitas\n• ${expenses} gastos\n\nAs transações foram categorizadas automaticamente pela IA.`);
      }
      
      setIsUploadDialogOpen(false);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert(`❌ Erro ao processar extratos:\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\nVerifique se os arquivos são extratos válidos (PDF ou CSV) e tente novamente.`);
    } finally {
      setIsUploadingStatement(false);
    }
  };

  const getTransactionsByMonth = (month: string) => {
    return transactions.filter(t => t.month === month);
  };

  const getMonthSummary = (month: string) => {
    const monthTransactions = getTransactionsByMonth(month);
    const income = monthTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return { income, expenses, balance: income - expenses };
  };

  const getCategoryTotals = (month: string) => {
    const monthTransactions = getTransactionsByMonth(month);
    const categoryTotals: Record<string, number> = {};
    
    console.log(`Calculando categorias para ${month}:`, monthTransactions.length, 'transações');
    console.log('Todas as transações do mês:', monthTransactions);
    
    monthTransactions.forEach(t => {
      if (t.type === 'debit') {
        console.log(`Transação: ${t.description} -> Categoria: "${t.category}" -> Valor: ${t.amount}`);
        if (!t.category || t.category.trim() === '') {
          console.warn(`⚠️ Categoria vazia para: ${t.description}`);
        }
        const category = t.category || 'Outros Gastos: Outros';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(t.amount);
      }
    });
    
    console.log('Categorias encontradas:', Object.keys(categoryTotals));
    
    const result = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    console.log('Top 5 categorias:', result);
    return result;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      // Limpa a string de data
      const cleanDate = dateString.toString().trim();
      
      if (!cleanDate || cleanDate === 'undefined' || cleanDate === 'null') {
        return 'Data inválida';
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
        return 'Data inválida';
      }
      
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.warn('Erro ao formatar data:', dateString, error);
      return 'Data inválida';
    }
  };

  const getLowConfidenceTransactions = () => {
    return transactions.filter(t => (t.confidence || 1) < 0.8);
  };

  const getConfidenceStats = () => {
    const total = transactions.length;
    const highConfidence = transactions.filter(t => (t.confidence || 1) >= 0.8).length;
    const mediumConfidence = transactions.filter(t => (t.confidence || 1) >= 0.6 && (t.confidence || 1) < 0.8).length;
    const lowConfidence = transactions.filter(t => (t.confidence || 1) < 0.6).length;
    
    return { total, highConfidence, mediumConfidence, lowConfidence };
  };

  const lowConfidenceTransactions = getLowConfidenceTransactions();
  const confidenceStats = getConfidenceStats();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Receitas Totais</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">
              {formatCurrency(data.summary.totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Gastos Totais</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">
              {formatCurrency(data.summary.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Saldo</CardTitle>
            <Badge variant={data.summary.balance >= 0 ? "default" : "destructive"}>
              {data.summary.balance >= 0 ? "Positivo" : "Negativo"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl ${data.summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.summary.balance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Precisão da IA</CardTitle>
            <Badge variant={confidenceStats.highConfidence / confidenceStats.total >= 0.8 ? "default" : "secondary"}>
              {Math.round((confidenceStats.highConfidence / confidenceStats.total) * 100)}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-green-600">Alta confiança:</span>
                <span>{confidenceStats.highConfidence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-600">Média confiança:</span>
                <span>{confidenceStats.mediumConfidence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Baixa confiança:</span>
                <span>{confidenceStats.lowConfidence}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Adicionar Extrato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Extrato à Planilha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Faça upload de novos extratos para adicionar transações à planilha atual.
              </p>
              {isUploadingStatement ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-600">Processando extratos...</p>
                    <p className="text-xs text-gray-500">A IA está analisando e categorizando suas transações</p>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv,.pdf"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        // Mostra quantos arquivos foram selecionados
                        const fileNames = Array.from(files).map(f => f.name).join(', ');
                        console.log(`${files.length} arquivo(s) selecionado(s): ${fileNames}`);
                        handleUploadStatement(files);
                      }
                    }}
                    className="hidden"
                    id="statement-upload"
                  />
                  <label htmlFor="statement-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Clique para selecionar arquivos CSV ou PDF</p>
                    <p className="text-xs text-gray-500 mt-1">Selecione múltiplos extratos bancários para processamento em lote</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">💡 Dica: Mantenha Ctrl/Cmd pressionado para selecionar múltiplos arquivos</p>
                  </label>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Transação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Transação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data</label>
                  <Input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={newTransaction.type} onValueChange={(value: 'debit' | 'credit') => setNewTransaction(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Despesa</SelectItem>
                      <SelectItem value="credit">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição da transação"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={newTransaction.category} onValueChange={(value) => setNewTransaction(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([group, items]) => (
                      <div key={group}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{group}</div>
                        {items.map(item => (
                          <SelectItem key={`${group}: ${item}`} value={`${group}: ${item}`}>
                            {item}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={addTransaction}>
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Transaction Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Transação</DialogTitle>
            </DialogHeader>
            {editingTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Data</label>
                    <Input
                      type="date"
                      value={editingTransaction.date}
                      onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, date: e.target.value } : null)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={editingTransaction.type} onValueChange={(value: 'debit' | 'credit') => setEditingTransaction(prev => prev ? { ...prev, type: value } : null)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Despesa</SelectItem>
                        <SelectItem value="credit">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={editingTransaction.description}
                    onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Descrição da transação"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Valor</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <Select value={editingTransaction.category} onValueChange={(value) => setEditingTransaction(prev => prev ? { ...prev, category: value } : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([group, items]) => (
                        <div key={group}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{group}</div>
                          {items.map(item => (
                            <SelectItem key={`${group}: ${item}`} value={`${group}: ${item}`}>
                              {item}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={editTransaction}>
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Low Confidence Alert */}
      {lowConfidenceTransactions.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Atenção: {lowConfidenceTransactions.length} transações precisam de revisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-yellow-700 text-sm">
                Algumas transações foram categorizadas com baixa confiança pela IA. 
                Elas estão destacadas em amarelo nas abas mensais.
              </p>
              
              <div className="bg-yellow-100 p-3 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Por que algumas transações precisam de revisão?</h4>
                <ul className="text-yellow-700 text-sm space-y-1">
                  <li>• <strong>Descrições genéricas:</strong> "TRANSFERENCIA", "PAGAMENTO", "DEBITO AUTOMATICO"</li>
                  <li>• <strong>Nomes de estabelecimentos não reconhecidos:</strong> Lojas ou serviços específicos</li>
                  <li>• <strong>Transações ambíguas:</strong> Podem pertencer a múltiplas categorias</li>
                  <li>• <strong>Novos tipos de transação:</strong> Que a IA ainda não conhece</li>
                </ul>
              </div>
              
              <div className="bg-blue-100 p-3 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Como revisar:</h4>
                <p className="text-blue-700 text-sm">
                  Clique na categoria de qualquer transação destacada em amarelo e selecione a categoria correta. 
                  A IA aprende com suas correções para melhorar futuras categorizações.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Tabs */}
      <Tabs value={activeMonth} onValueChange={setActiveMonth} className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-12">
          {data.months.map(month => (
            <TabsTrigger key={month} value={month} className="text-xs">
              {month}
            </TabsTrigger>
          ))}
          <TabsTrigger value="consolidado" className="text-xs col-span-2">
            Consolidado
          </TabsTrigger>
        </TabsList>

        {data.months.map(month => (
          <TabsContent key={month} value={month} className="space-y-6">
            <MonthView
              month={month}
              transactions={getTransactionsByMonth(month)}
              summary={getMonthSummary(month)}
              categoryTotals={getCategoryTotals(month)}
              onUpdateCategory={updateTransactionCategory}
              onEditTransaction={openEditDialog}
              onDeleteTransaction={deleteTransaction}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          </TabsContent>
        ))}

        <TabsContent value="consolidado" className="space-y-6">
          <ConsolidatedView
            data={data}
            transactions={transactions}
            formatCurrency={formatCurrency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MonthViewProps {
  month: string;
  transactions: Transaction[];
  summary: { income: number; expenses: number; balance: number };
  categoryTotals: [string, number][];
  onUpdateCategory: (id: string, category: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
}

function MonthView({ 
  month, 
  transactions, 
  summary, 
  categoryTotals, 
  onUpdateCategory, 
  onEditTransaction,
  onDeleteTransaction,
  formatCurrency, 
  formatDate 
}: MonthViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Transactions Table */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Transações - {month}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm">Data</th>
                    <th className="text-left p-2 text-sm">Descrição</th>
                    <th className="text-left p-2 text-sm">Categoria</th>
                    <th className="text-right p-2 text-sm">Valor</th>
                    <th className="text-center p-2 text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(transaction => (
                    <tr 
                      key={transaction.id} 
                      className={`border-b hover:bg-gray-50 ${
                        (transaction.confidence || 1) < 0.8 ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="p-2 text-sm">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="p-2 text-sm">
                        <div className="flex items-center">
                          <span>{transaction.description}</span>
                          {(transaction.confidence || 1) < 0.8 && (
                            <div className="flex items-center ml-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-1" />
                              <span className="text-xs text-yellow-600 bg-yellow-100 px-1 rounded">
                                {(transaction.confidence || 1) * 100}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <Select
                          value={transaction.category}
                          onValueChange={(value) => onUpdateCategory(transaction.id, value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORIES).map(([group, items]) => (
                              <div key={group}>
                                <div className="px-2 py-1 text-xs text-gray-500 font-medium">
                                  {group}
                                </div>
                                {items.map(item => (
                                  <SelectItem key={`${group}: ${item}`} value={`${group}: ${item}`}>
                                    {item}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className={`p-2 text-sm text-right ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditTransaction(transaction)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteTransaction(transaction.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Summary */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumo - {month}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm">Receitas:</span>
              <span className="text-sm text-green-600">{formatCurrency(summary.income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Gastos:</span>
              <span className="text-sm text-red-600">{formatCurrency(summary.expenses)}</span>
            </div>
            <hr />
            <div className="flex justify-between font-medium">
              <span>Saldo:</span>
              <span className={summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(summary.balance)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryTotals.map(([category, amount]) => (
                <div key={category} className="flex justify-between text-sm">
                  <span className="truncate">{category}</span>
                  <span className="text-red-600">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ConsolidatedViewProps {
  data: SpreadsheetData;
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
}

function ConsolidatedView({ data, transactions, formatCurrency }: ConsolidatedViewProps) {
  const getCategoryTotals = () => {
    const categoryTotals: Record<string, number> = {};
    
    transactions.forEach(t => {
      if (t.type === 'debit') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
      }
    });
    
    return Object.entries(categoryTotals).sort(([,a], [,b]) => b - a);
  };

  const getMonthlyTrend = () => {
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    data.months.forEach(month => {
      const monthTransactions = transactions.filter(t => t.month === month);
      monthlyData[month] = {
        income: monthTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0),
        expenses: monthTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + Math.abs(t.amount), 0)
      };
    });
    
    return monthlyData;
  };

  const categoryTotals = getCategoryTotals();
  const monthlyTrend = getMonthlyTrend();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {categoryTotals.map(([category, amount]) => (
              <div key={category} className="flex justify-between text-sm">
                <span className="truncate">{category}</span>
                <span className="text-red-600">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tendência Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Object.entries(monthlyTrend).map(([month, data]) => (
              <div key={month} className="p-3 border rounded-lg">
                <div className="font-medium text-sm mb-2">{month}</div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">
                    Receitas: {formatCurrency(data.income)}
                  </span>
                  <span className="text-red-600">
                    Gastos: {formatCurrency(data.expenses)}
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium">
                  Saldo: 
                  <span className={data.income - data.expenses >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(data.income - data.expenses)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}