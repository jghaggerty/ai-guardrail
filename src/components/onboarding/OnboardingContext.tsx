import { createContext, useContext, useState, ReactNode } from 'react';

export type OnboardingStep = 
  | 'signup' 
  | 'verify-email' 
  | 'organization' 
  | 'team-setup'
  | 'llm-selection'
  | 'api-keys'
  | 'test-suite'
  | 'automation'
  | 'summary'
  | 'complete';

export interface TeamInvite {
  email: string;
  role: 'admin' | 'evaluator' | 'viewer';
}

export interface LLMConfig {
  id: string;
  provider: string;
  modelName: string;
  displayName: string;
  description: string;
  apiKey?: string;
  baseUrl?: string;
  environment: 'development' | 'production';
  modelVersion?: string;
  isConnected: boolean;
  isSelected: boolean;
}

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
  
  // Team & Billing
  teamInvites: TeamInvite[];
  billingEmail: string;
  billingContactName: string;
  useSameEmailForBilling: boolean;
  
  // LLM Configuration
  llmConfigs: LLMConfig[];
  
  // Test Suite & Fairness
  testSuites: string[];
  protectedAttributes: string[];
  sampleSize: number;
  confidenceInterval: number;
  temperature: number;
  keepTemperatureConstant: boolean;
  
  // Automation
  scheduleFrequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  alertThreshold: 'conservative' | 'moderate' | 'aggressive';
  alertEmails: string[];
  reportEmails: string[];
  
  // Final confirmations
  methodologyRead: boolean;
  dataProcessingConfirmed: boolean;
}

interface OnboardingContextType {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  resetOnboarding: () => void;
}

export const DEFAULT_LLM_CONFIGS: LLMConfig[] = [
  { id: 'openai-gpt4', provider: 'OpenAI', modelName: 'gpt-4', displayName: 'GPT-4', description: 'Most capable OpenAI model for complex tasks', environment: 'development', isConnected: false, isSelected: false },
  { id: 'openai-gpt4-turbo', provider: 'OpenAI', modelName: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', description: 'Faster and more cost-effective GPT-4', environment: 'development', isConnected: false, isSelected: false },
  { id: 'openai-gpt35', provider: 'OpenAI', modelName: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo', description: 'Fast and affordable for simpler tasks', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-opus', provider: 'Anthropic', modelName: 'claude-3-opus', displayName: 'Claude 3 Opus', description: 'Most powerful Claude model', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-sonnet', provider: 'Anthropic', modelName: 'claude-3-sonnet', displayName: 'Claude 3 Sonnet', description: 'Balanced performance and speed', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-haiku', provider: 'Anthropic', modelName: 'claude-3-haiku', displayName: 'Claude 3 Haiku', description: 'Fast and cost-effective', environment: 'development', isConnected: false, isSelected: false },
  { id: 'google-gemini-pro', provider: 'Google', modelName: 'gemini-pro', displayName: 'Gemini Pro', description: 'Google\'s advanced multimodal model', environment: 'development', isConnected: false, isSelected: false },
  { id: 'google-gemini-15', provider: 'Google', modelName: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'Long context and enhanced reasoning', environment: 'development', isConnected: false, isSelected: false },
  { id: 'meta-llama3', provider: 'Meta', modelName: 'llama-3', displayName: 'Llama 3', description: 'Open-source, locally deployable', environment: 'development', isConnected: false, isSelected: false },
  { id: 'custom', provider: 'Custom', modelName: 'custom-endpoint', displayName: 'Custom Endpoint', description: 'Self-hosted or private LLM', environment: 'development', isConnected: false, isSelected: false },
];

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
  teamInvites: [],
  billingEmail: '',
  billingContactName: '',
  useSameEmailForBilling: true,
  llmConfigs: DEFAULT_LLM_CONFIGS,
  testSuites: ['cognitive_bias'],
  protectedAttributes: [],
  sampleSize: 500,
  confidenceInterval: 0.95,
  temperature: 0.7,
  keepTemperatureConstant: true,
  scheduleFrequency: 'monthly',
  alertThreshold: 'moderate',
  alertEmails: [],
  reportEmails: [],
  methodologyRead: false,
  dataProcessingConfirmed: false,
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
