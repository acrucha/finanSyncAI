import React, { useState, useEffect } from 'react';
import { FileText, Brain, CheckCircle, Loader2 } from 'lucide-react';

const LOADING_STEPS = [
  {
    icon: FileText,
    title: "Lendo extrato bancário",
    description: "Analisando estrutura do arquivo..."
  },
  {
    icon: Brain,
    title: "Processando com IA",
    description: "Categorizando transações automaticamente..."
  },
  {
    icon: CheckCircle,
    title: "Organizando dados",
    description: "Preparando sua planilha orçamentária..."
  }
];

export function LoadingState() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        const next = (prev + 1) % LOADING_STEPS.length;
        if (next === 0) {
          setCompletedSteps(prev => [...prev, LOADING_STEPS.length - 1]);
        } else {
          setCompletedSteps(prev => [...prev, prev.length]);
        }
        return next;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
          <h1 className="text-2xl text-gray-900 mb-2">
            Analisando seu extrato
          </h1>
          <p className="text-gray-600">
            Nossa IA está processando suas transações...
          </p>
        </div>

        <div className="space-y-6">
          {LOADING_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = completedSteps.includes(index);
            
            return (
              <div
                key={index}
                className={`
                  flex items-center space-x-4 p-4 rounded-lg transition-all duration-500
                  ${isActive ? 'bg-green-50 border-2 border-green-200' : 'bg-white border border-gray-200'}
                  ${isCompleted ? 'opacity-60' : ''}
                `}
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-colors
                  ${isCompleted ? 'bg-green-500' : isActive ? 'bg-green-100' : 'bg-gray-100'}
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-gray-400'}`} />
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className={`font-medium ${isActive ? 'text-green-900' : 'text-gray-700'}`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm ${isActive ? 'text-green-700' : 'text-gray-500'}`}>
                    {step.description}
                  </p>
                </div>
                
                {isActive && (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <div className="bg-green-100 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              🔒 Seus dados estão sendo processados com segurança e não são armazenados permanentemente.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / LOADING_STEPS.length) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            {Math.round(((currentStep + 1) / LOADING_STEPS.length) * 100)}% concluído
          </p>
        </div>
      </div>
    </div>
  );
}