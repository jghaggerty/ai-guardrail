import { Check } from 'lucide-react';
import { OnboardingStep } from './OnboardingContext';

interface StepIndicatorProps {
  currentStep: OnboardingStep;
}

const steps = [
  { key: 'signup', label: 'Account' },
  { key: 'verify-email', label: 'Verify' },
  { key: 'organization', label: 'Org' },
  { key: 'team-setup', label: 'Team' },
  { key: 'llm-selection', label: 'LLMs' },
  { key: 'api-keys', label: 'Keys' },
  { key: 'test-suite', label: 'Tests' },
  { key: 'automation', label: 'Schedule' },
  { key: 'summary', label: 'Launch' },
] as const;

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  // Group steps for cleaner display
  const getStepGroup = (key: string) => {
    if (['signup', 'verify-email'].includes(key)) return 1;
    if (['organization', 'team-setup'].includes(key)) return 2;
    return 3;
  };

  const currentGroup = getStepGroup(currentStep);

  return (
    <div className="mb-6">
      {/* Group indicators */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {[1, 2, 3].map(group => (
          <div key={group} className="flex items-center gap-2">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
              ${group < currentGroup 
                ? 'bg-success text-success-foreground' 
                : group === currentGroup 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }
            `}>
              {group < currentGroup ? <Check className="h-3 w-3" /> : group}
            </div>
            <span className={`text-xs ${group === currentGroup ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {group === 1 ? 'Account' : group === 2 ? 'Organization' : 'Setup'}
            </span>
            {group < 3 && <div className={`w-8 h-0.5 ${group < currentGroup ? 'bg-success' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>
      
      {/* Detailed step indicator */}
      <div className="flex items-center justify-center gap-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex items-center">
              <div
                className={`
                  w-2 h-2 rounded-full transition-all duration-200
                  ${isCompleted 
                    ? 'bg-success' 
                    : isCurrent 
                      ? 'bg-primary w-4' 
                      : 'bg-muted'
                  }
                `}
                title={step.label}
              />
              {index < steps.length - 1 && (
                <div className={`w-2 h-0.5 ${index < currentIndex ? 'bg-success' : 'bg-muted'}`} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>
    </div>
  );
}
