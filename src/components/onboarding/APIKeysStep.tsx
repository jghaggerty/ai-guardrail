import { useState } from 'react';
import { useOnboarding, LLMConfig } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, EyeOff, Shield, Check, X, Loader2, AlertTriangle } from 'lucide-react';

const MODEL_VERSIONS: Record<string, string[]> = {
  // OpenAI
  'gpt-5': ['gpt-5-latest'],
  'gpt-4.5-preview': ['gpt-4.5-preview-2025-02-27'],
  'gpt-4o': ['gpt-4o-2024-11-20', 'gpt-4o-2024-08-06'],
  'gpt-4-turbo': ['gpt-4-turbo-2024-04-09', 'gpt-4-turbo-preview'],
  'gpt-4': ['gpt-4-0613', 'gpt-4-0314'],
  'gpt-3.5-turbo': ['gpt-3.5-turbo-0125', 'gpt-3.5-turbo-1106'],
  // Anthropic
  'claude-opus-4-5-20251101': ['claude-opus-4-5-20251101'],
  'claude-sonnet-4-20250514': ['claude-sonnet-4-20250514'],
  'claude-3-5-sonnet-20241022': ['claude-3-5-sonnet-20241022'],
  'claude-3-5-haiku-20241022': ['claude-3-5-haiku-20241022'],
  'claude-3-opus-20240229': ['claude-3-opus-20240229'],
  // Google
  'gemini-2.5-pro': ['gemini-2.5-pro-preview-06-05'],
  'gemini-2.5-flash': ['gemini-2.5-flash-preview-05-20'],
  'gemini-1.5-pro': ['gemini-1.5-pro-latest', 'gemini-1.5-pro-002'],
  'gemini-1.5-flash': ['gemini-1.5-flash-latest', 'gemini-1.5-flash-002'],
  'gemini-pro': ['gemini-1.0-pro-latest'],
  // Meta (Llama)
  'llama-4-scout': ['Llama-4-Scout-17B-16E-Instruct'],
  'llama-4-maverick': ['Llama-4-Maverick-17B-128E-Instruct-FP8'],
  'llama-3.1-405b': ['Meta-Llama-3.1-405B-Instruct-Turbo'],
  'llama-3.1-70b': ['Meta-Llama-3.1-70B-Instruct-Turbo'],
  'llama-3.1-8b': ['Meta-Llama-3.1-8B-Instruct-Turbo'],
  // DeepSeek
  'deepseek-v3': ['deepseek-chat'],
  'deepseek-r1': ['deepseek-reasoner'],
};

export function APIKeysStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { toast } = useToast();
  
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingConnection, setTestingConnection] = useState<Record<string, boolean>>({});

  const selectedConfigs = data.llmConfigs.filter(c => c.isSelected);
  const connectedCount = selectedConfigs.filter(c => c.isConnected).length;

  const updateConfig = (id: string, updates: Partial<LLMConfig>) => {
    const updated = data.llmConfigs.map(config =>
      config.id === id ? { ...config, ...updates } : config
    );
    updateData({ llmConfigs: updated });
  };

  const handleTestConnection = async (config: LLMConfig) => {
    if (!config.apiKey) {
      toast({ title: 'Error', description: 'Please enter an API key first', variant: 'destructive' });
      return;
    }

    setTestingConnection(prev => ({ ...prev, [config.id]: true }));

    // Simulate API connection test
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo, mark as connected if key is at least 20 chars
    const isValid = config.apiKey.length >= 20;
    
    updateConfig(config.id, { isConnected: isValid });
    setTestingConnection(prev => ({ ...prev, [config.id]: false }));

    if (isValid) {
      toast({ title: 'Connected', description: `Successfully connected to ${config.displayName}` });
    } else {
      toast({ title: 'Connection Failed', description: 'Invalid API key format. Please check and try again.', variant: 'destructive' });
    }
  };

  const handleBack = () => setStep('llm-selection');
  
  const handleNext = () => setStep('test-suite');

  const handleSkip = () => {
    toast({ 
      title: 'Skipped API Setup', 
      description: 'You can configure API keys later from settings.',
      variant: 'default'
    });
    setStep('test-suite');
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Connect Your LLMs</h1>
        <p className="text-muted-foreground mt-1">
          Add API keys to enable testing. Keys are encrypted and never logged.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
        <Shield className="h-5 w-5 text-primary mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Your API keys are secure</p>
          <p className="text-muted-foreground">
            Keys are encrypted at rest and only used for evaluation testing. 
            <a href="#" className="text-primary hover:underline ml-1">Learn more about our security</a>
          </p>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">API Configuration</h3>
        <Badge variant={connectedCount === selectedConfigs.length ? 'default' : 'secondary'}>
          {connectedCount} of {selectedConfigs.length} connected
        </Badge>
      </div>

      {/* Config forms for each selected LLM */}
      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
        {selectedConfigs.map(config => (
          <div key={config.id} className="p-4 border border-border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{config.displayName}</h4>
                <Badge variant="outline" className="text-xs">{config.provider}</Badge>
              </div>
              {config.isConnected ? (
                <Badge className="bg-success text-success-foreground">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* API Key */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`key-${config.id}`}>API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={`key-${config.id}`}
                      type={showKeys[config.id] ? 'text' : 'password'}
                      placeholder={config.provider === 'OpenAI' ? 'sk-...' : 'Enter API key'}
                      value={config.apiKey || ''}
                      onChange={(e) => updateConfig(config.id, { apiKey: e.target.value, isConnected: false })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys(prev => ({ ...prev, [config.id]: !prev[config.id] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKeys[config.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(config)}
                    disabled={testingConnection[config.id] || !config.apiKey}
                    className="min-w-[100px]"
                  >
                    {testingConnection[config.id] ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Testing</>
                    ) : config.isConnected ? (
                      <><Check className="h-4 w-4 mr-1" /> Verified</>
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
              </div>

              {/* Custom endpoint URL */}
              {config.provider === 'Custom' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`url-${config.id}`}>Base URL</Label>
                  <Input
                    id={`url-${config.id}`}
                    placeholder="https://your-api-endpoint.com/v1"
                    value={config.baseUrl || ''}
                    onChange={(e) => updateConfig(config.id, { baseUrl: e.target.value })}
                  />
                </div>
              )}

              {/* Environment */}
              <div className="space-y-2">
                <Label>Environment</Label>
                <RadioGroup
                  value={config.environment}
                  onValueChange={(value) => updateConfig(config.id, { environment: value as 'development' | 'production' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="development" id={`dev-${config.id}`} />
                    <Label htmlFor={`dev-${config.id}`} className="font-normal cursor-pointer">Development</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id={`prod-${config.id}`} />
                    <Label htmlFor={`prod-${config.id}`} className="font-normal cursor-pointer">Production</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Model Version */}
              {MODEL_VERSIONS[config.modelName] && (
                <div className="space-y-2">
                  <Label>Model Version</Label>
                  <Select 
                    value={config.modelVersion || 'latest'} 
                    onValueChange={(value) => updateConfig(config.id, { modelVersion: value === 'latest' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Latest (default)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="latest">Latest (default)</SelectItem>
                      {MODEL_VERSIONS[config.modelName].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
          Skip for now
        </Button>
        <Button onClick={handleNext} className="flex-1" size="lg">
          Next: Test Suite Selection
        </Button>
      </div>
    </div>
  );
}
