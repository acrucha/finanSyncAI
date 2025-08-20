import React, { useState, useRef, DragEvent } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

interface FileUploaderProps {
  workflow: 'new' | 'update';
  onFileUpload: (files: FileList) => void;
  disabled?: boolean;
}

export function FileUploader({ workflow, onFileUpload, disabled }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingFileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File, type: 'statement' | 'existing') => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (file.size > maxSize) {
      return 'Arquivo muito grande. Máximo 10MB.';
    }

    if (type === 'statement') {
      const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
      const allowedExtensions = ['.pdf', '.csv'];
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        return 'Formato inválido para extrato. Use PDF ou CSV.';
      }
    } else {
      // Para planilhas existentes - aceita XLSX e CSV
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        return 'Formato inválido para planilha. Use XLSX, XLS ou CSV.';
      }
    }

    return null;
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    
    // Agora ambos workflows suportam múltiplos arquivos
    if (workflow === 'new' || workflow === 'update') {
      // Valida todos os arquivos como extratos (suporte a múltiplos)
      for (const file of files) {
        const validation = validateFile(file, 'statement');
        if (validation) {
          setError(`Erro no arquivo "${file.name}": ${validation}`);
          return;
        }
      }
      
      if (workflow === 'update') {
        // Para update, adiciona os novos arquivos mas preserva planilha existente se houver
        setSelectedFiles(prev => {
          const existingFile = prev.find((_, index) => index >= files.length && prev[index]?.name.endsWith('.xlsx'));
          return existingFile ? [...files, existingFile] : files;
        });
      } else {
        // Para new, simplesmente adiciona os arquivos
        setSelectedFiles(files);
      }
      return;
    }

    // Fallback para outros workflows (se existirem)
    const statementValidation = validateFile(files[0], 'statement');
    if (statementValidation) {
      setError(statementValidation);
      return;
    }

    setSelectedFiles(files);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    console.log('🎯 Arquivos selecionados via input:', Array.from(selectedFiles).map(f => ({ name: f.name, type: f.type, size: f.size })));
    await handleFiles(selectedFiles);
    
    // Limpar o input para permitir selecionar os mesmos arquivos novamente
    event.target.value = '';
  };

  const handleFiles = async (fileList: FileList) => {
    console.log(`🔄 Processando ${fileList.length} arquivos`);
    setError(null);
    
    const filesArray = Array.from(fileList);
    
    // Validar todos os arquivos primeiro como extratos
    for (const file of filesArray) {
      console.log(`📋 Validando: ${file.name} (${file.type})`);
      try {
        const validation = validateFile(file, 'statement');
        if (validation) {
          console.error(`❌ Arquivo inválido: ${file.name} - ${validation}`);
          setError(`Arquivo "${file.name}" tem formato inválido: ${validation}`);
          return;
        }
      } catch (validationError) {
        console.error(`❌ Erro na validação do arquivo ${file.name}:`, validationError);
        setError(`Erro ao validar arquivo "${file.name}": ${validationError instanceof Error ? validationError.message : 'Erro desconhecido'}`);
        return;
      }
    }
    
    console.log('✅ Todos os arquivos passaram na validação');
    
    // Se chegou aqui, todos os arquivos são válidos
    const validFiles = filesArray;
    
    if (validFiles.length === 0) {
      setError('Nenhum arquivo válido foi selecionado');
      return;
    }
    
    console.log(`✅ Arquivos válidos para upload: ${validFiles.map(f => f.name).join(', ')}`);
    
    try {
      await onFileUpload(fileList);
      console.log('✅ Upload concluído com sucesso');
    } catch (uploadError) {
      console.error('❌ Erro durante o upload:', uploadError);
      
      // Tratamento específico para diferentes tipos de erro
      if (uploadError instanceof Error) {
        if (uploadError.message.includes('planilha')) {
          setError(`Erro ao processar planilha: ${uploadError.message}`);
        } else if (uploadError.message.includes('Formato de arquivo não suportado')) {
          setError(`Formato de arquivo inválido: ${uploadError.message}`);
        } else if (uploadError.message.includes('Nenhuma transação válida')) {
          setError(`Dados inválidos: ${uploadError.message}`);
        } else if (uploadError.message.includes('fetch')) {
          setError('Erro de conexão. Verifique sua internet e tente novamente.');
        } else {
          setError(`Erro no upload: ${uploadError.message}`);
        }
      } else {
        setError(`Erro inesperado: ${String(uploadError)}`);
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      setError('Selecione pelo menos um arquivo.');
      return;
    }

    if (workflow === 'update') {
      // Verifica se há pelo menos um extrato
      const statements = selectedFiles.filter(f => {
        const isXlsx = f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls');
        const isCsvSpreadsheet = f.name.toLowerCase().endsWith('.csv') && f.size > 50000;
        return !isXlsx && !isCsvSpreadsheet;
      });
      
      if (statements.length === 0) {
        setError('Selecione pelo menos um extrato bancário (PDF ou CSV).');
        return;
      }
    }

    const fileList = new DataTransfer();
    selectedFiles.forEach(file => fileList.items.add(file));
    onFileUpload(fileList.files);
  };

  const canUpload = workflow === 'new' ? selectedFiles.length === 1 : selectedFiles.length >= 1;

  return (
    <div className="space-y-6">
      {/* Drag and Drop Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-colors
          ${dragActive ? 'border-green-400 bg-green-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-green-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="text-lg text-gray-900 mb-2">
            {workflow === 'new' 
              ? 'Arraste seus extratos bancários aqui'
              : 'Arraste seus arquivos aqui'
            }
          </div>
          <p className="text-gray-600 mb-4">
            ou clique para selecionar {workflow === 'new' ? 'múltiplos arquivos' : 'arquivos'}
          </p>
          <p className="text-sm text-gray-500">
            {workflow === 'new' 
              ? 'Formatos aceitos: PDF, CSV (múltiplos arquivos, máx. 10MB cada)'
              : 'Extratos: PDF/CSV (múltiplos) | Planilha: XLSX/CSV (opcional, máx. 10MB cada)'
            }
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={workflow === 'new' ? '.pdf,.csv' : '.pdf,.csv,.xlsx'}
          multiple={true}
          onChange={handleFileSelect}
          disabled={disabled}
        />
      </div>

      {/* Manual File Selection for Update Workflow */}
      {workflow === 'update' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Dica:</strong> Se você fornecer uma planilha existente, o sistema evitará duplicatas automaticamente. 
              Caso contrário, será criada uma nova planilha baseada no template oficial.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Planilha Existente (opcional) - para evitar duplicatas
              </label>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <File className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => existingFileInputRef.current?.click()}
                  disabled={disabled}
                >
                  Selecionar XLSX/CSV
                </Button>
              </div>
              <input
                ref={existingFileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                disabled={disabled}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Novo(s) Extrato(s) *
              </label>
              <div className="border border-gray-300 rounded-lg p-4 text-center">
                <File className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                >
                  Selecionar PDF/CSV (múltiplos)
                </Button>
                <p className="text-xs text-gray-500 mt-1">Ctrl/Cmd + clique para múltiplos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm text-gray-700">Arquivos selecionados:</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center space-x-3">
                <File className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                    {workflow === 'update' && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {file.name.toLowerCase().endsWith('.xlsx') || 
                         file.name.toLowerCase().endsWith('.xls') || 
                         (file.name.toLowerCase().endsWith('.csv') && file.size > 50000) 
                          ? 'Planilha Existente' 
                          : 'Extrato'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Button */}
      <Button
        onClick={handleUpload}
        disabled={!canUpload || disabled}
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
      >
        {disabled ? 'Processando...' : 'Analisar com IA'}
      </Button>
    </div>
  );
}