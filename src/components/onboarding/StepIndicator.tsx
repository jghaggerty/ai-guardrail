import { Check } from 'lucide-react';
import { OnboardingStep } from './OnboardingContext';

interface StepIndicatorProps {
  currentStep: OnboardingStep;
}

const steps = [
  { key: 'signup', label: 'Account' },
  { key: 'verify-email', label: 'Verify' },
  { key: 'organization', label: 'Organization' },
  { key: 'complete', label: 'Complete' },
] as const;

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-200
                  ${isCompleted 
                    ? 'bg-success text-success-foreground' 
                    : isCurrent 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`
                text-xs mt-1 hidden sm:block
                ${isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}
              `}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div 
                className={`
                  w-8 sm:w-12 h-0.5 mx-1
                  ${index < currentIndex ? 'bg-success' : 'bg-muted'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
