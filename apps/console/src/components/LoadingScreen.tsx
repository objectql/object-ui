
import { Spinner } from '@object-ui/components';
import { Database, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';

interface LoadingScreenProps {
  /** Optional message override */
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { t } = useObjectTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const loadingSteps = useMemo(() => [
    t('console.loadingSteps.connecting'),
    t('console.loadingSteps.loadingConfig'),
    t('console.loadingSteps.preparingWorkspace'),
  ], [t]);

  useEffect(() => {
    if (message) return; // skip auto-progression when message is overridden
    const timer = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, 1200);
    return () => clearInterval(timer);
  }, [message, loadingSteps.length]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
          <div className="relative bg-linear-to-br from-primary to-primary/80 p-4 rounded-2xl shadow-lg">
            <Database className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{t('console.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('console.initializing')}</p>
        </div>
        
        {/* Progress steps */}
        {message ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-full">
            <Spinner className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">{message}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-64">
            {loadingSteps.map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-2.5 text-sm transition-opacity duration-300"
                style={{ opacity: index <= currentStep ? 1 : 0.3 }}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : index === currentStep ? (
                  <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className={index <= currentStep ? 'text-foreground' : 'text-muted-foreground'}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
