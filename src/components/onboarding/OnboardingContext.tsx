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
  // OpenAI models
  { id: 'openai-gpt5', provider: 'OpenAI', modelName: 'gpt-5', displayName: 'GPT-5', description: 'Latest and most capable OpenAI model', environment: 'development', isConnected: false, isSelected: false },
  { id: 'openai-gpt45', provider: 'OpenAI', modelName: 'gpt-4.5-preview', displayName: 'GPT-4.5', description: 'Advanced reasoning with improved capabilities', environment: 'development', isConnected: false, isSelected: false },
  { id: 'openai-gpt4o', provider: 'OpenAI', modelName: 'gpt-4o', displayName: 'GPT-4o', description: 'Optimized GPT-4 for speed and efficiency', environment: 'development', isConnected: false, isSelected: false },
  { id: 'openai-gpt4-turbo', provider: 'OpenAI', modelName: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', description: 'Faster and more cost-effective GPT-4', environment: 'development', isConnected: false, isSelected: false },
  { id: 'openai-gpt4', provider: 'OpenAI', modelName: 'gpt-4', displayName: 'GPT-4', description: 'Capable OpenAI model for complex tasks', environment: 'development', isConnected: false, isSelected: false },

  // Anthropic models
  { id: 'anthropic-opus-45', provider: 'Anthropic', modelName: 'claude-opus-4-5-20251101', displayName: 'Claude Opus 4.5', description: 'Most powerful Claude model with extended thinking', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-claude-41', provider: 'Anthropic', modelName: 'claude-sonnet-4-20250514', displayName: 'Claude 4.1 (Sonnet 4)', description: 'Latest Claude with improved coding and reasoning', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-opus', provider: 'Anthropic', modelName: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', description: 'Powerful Claude 3 model', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-sonnet', provider: 'Anthropic', modelName: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet', description: 'Balanced performance and speed', environment: 'development', isConnected: false, isSelected: false },
  { id: 'anthropic-haiku', provider: 'Anthropic', modelName: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku', description: 'Fast and cost-effective', environment: 'development', isConnected: false, isSelected: false },

  // Google models
  { id: 'google-gemini-25-pro', provider: 'Google', modelName: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Latest Google model with advanced reasoning', environment: 'development', isConnected: false, isSelected: false },
  { id: 'google-gemini-25-flash', provider: 'Google', modelName: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast and efficient Gemini 2.5', environment: 'development', isConnected: false, isSelected: false },
  { id: 'google-gemini-15-pro', provider: 'Google', modelName: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'Long context and enhanced reasoning', environment: 'development', isConnected: false, isSelected: false },
  { id: 'google-gemini-15-flash', provider: 'Google', modelName: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', description: 'Fast multimodal model', environment: 'development', isConnected: false, isSelected: false },

  // Meta (Llama) models - via inference providers
  { id: 'meta-llama4-scout', provider: 'Meta', modelName: 'llama-4-scout', displayName: 'Llama 4 Scout', description: 'Latest Llama 4 model with MoE architecture', environment: 'development', isConnected: false, isSelected: false },
  { id: 'meta-llama4-maverick', provider: 'Meta', modelName: 'llama-4-maverick', displayName: 'Llama 4 Maverick', description: 'Large-scale Llama 4 with 128 experts', environment: 'development', isConnected: false, isSelected: false },
  { id: 'meta-llama31-405b', provider: 'Meta', modelName: 'llama-3.1-405b', displayName: 'Llama 3.1 405B', description: 'Largest open-weight model available', environment: 'development', isConnected: false, isSelected: false },
  { id: 'meta-llama31-70b', provider: 'Meta', modelName: 'llama-3.1-70b', displayName: 'Llama 3.1 70B', description: 'High-performance open model', environment: 'development', isConnected: false, isSelected: false },
  { id: 'meta-llama31-8b', provider: 'Meta', modelName: 'llama-3.1-8b', displayName: 'Llama 3.1 8B', description: 'Efficient smaller Llama model', environment: 'development', isConnected: false, isSelected: false },

  // DeepSeek models
  { id: 'deepseek-v3', provider: 'DeepSeek', modelName: 'deepseek-v3', displayName: 'DeepSeek V3', description: 'Latest DeepSeek chat model with MoE', environment: 'development', isConnected: false, isSelected: false },
  { id: 'deepseek-r1', provider: 'DeepSeek', modelName: 'deepseek-r1', displayName: 'DeepSeek R1', description: 'Reasoning model with chain-of-thought', environment: 'development', isConnected: false, isSelected: false },

  // Custom endpoint
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
