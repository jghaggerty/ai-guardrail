import { useState } from 'react';
import { useOnboarding, LLMConfig } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bot, Search, ExternalLink } from 'lucide-react';

const PROVIDER_COLORS: Record<string, string> = {
  'OpenAI': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Anthropic': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Google': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Meta': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  'Custom': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

export function LLMSelectionStep() {
  const { data, updateData, setStep } = useOnboarding();
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCount = data.llmConfigs.filter(c => c.isSelected).length;
  const totalCount = data.llmConfigs.length;

  const filteredConfigs = data.llmConfigs.filter(config =>
    config.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
    config.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleSelect = (id: string) => {
    const updated = data.llmConfigs.map(config =>
      config.id === id ? { ...config, isSelected: !config.isSelected } : config
    );
    updateData({ llmConfigs: updated });
  };

  const handleBack = () => setStep('team-setup');
  
  const handleNext = () => {
    if (selectedCount === 0) return;
    setStep('api-keys');
  };

  // Group by provider
  const groupedConfigs = filteredConfigs.reduce((acc, config) => {
    if (!acc[config.provider]) acc[config.provider] = [];
    acc[config.provider].push(config);
    return acc;
  }, {} as Record<string, LLMConfig[]>);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Which LLMs Do You Want to Evaluate?</h1>
        <p className="text-muted-foreground mt-1">
          Select the models you want to test for behavioral biases. You can add more later.
        </p>
      </div>

      {/* Search and counter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant={selectedCount > 0 ? 'default' : 'secondary'} className="px-3 py-1">
          {selectedCount} of {totalCount} selected
        </Badge>
      </div>

      {/* Model cards grouped by provider */}
      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
        {Object.entries(groupedConfigs).map(([provider, configs]) => (
          <div key={provider}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Badge variant="outline" className={PROVIDER_COLORS[provider]}>
                {provider}
              </Badge>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {configs.map(config => (
                <div
                  key={config.id}
                  onClick={() => handleToggleSelect(config.id)}
                  className={`
                    relative p-4 rounded-lg border cursor-pointer transition-all
                    ${config.isSelected 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={config.isSelected}
                      onCheckedChange={() => handleToggleSelect(config.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground truncate">{config.displayName}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {config.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Info link */}
      <div className="text-center">
        <a href="#" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Learn about supported models
        </a>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          className="flex-1"
          size="lg"
          disabled={selectedCount === 0}
        >
          Next: Add API Keys
        </Button>
      </div>
    </div>
  );
}
