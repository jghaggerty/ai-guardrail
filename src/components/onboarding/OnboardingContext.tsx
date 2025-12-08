import { createContext, useContext, useState, ReactNode } from 'react';

export type OnboardingStep = 
  | 'signup' 
  | 'verify-email' 
  | 'organization' 
  | 'complete';

export interface OnboardingData {
  // Account
  email: string;
  password: string;
  fullName: string;
  jobTitle: string;
  tosAccepted: boolean;
  dpaAccepted: boolean;
  
  // Organization
  companyName: string;
  companySize: string;
  industry: string[];
  headquartersCountry: string;
  headquartersState: string;
}

interface OnboardingContextType {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  resetOnboarding: () => void;
}

const defaultData: OnboardingData = {
  email: '',
  password: '',
  fullName: '',
  jobTitle: '',
  tosAccepted: false,
  dpaAccepted: false,
  companyName: '',
  companySize: '',
  industry: [],
  headquartersCountry: '',
  headquartersState: '',
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<OnboardingStep>('signup');
  const [data, setData] = useState<OnboardingData>(defaultData);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const resetOnboarding = () => {
    setStep('signup');
    setData(defaultData);
  };

  return (
    <OnboardingContext.Provider value={{ step, setStep, data, updateData, resetOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
