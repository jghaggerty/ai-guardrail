import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeuristicType } from '@/types/bias';
import { Play, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfigurationPanelProps {
  onStartEvaluation: (config: {
    selectedHeuristics: HeuristicType[];
    iterations: number;
    systemName: string;
  }) => void;
  isRunning: boolean;
}

const aiSystems = [
  'GPT-4',
  'GPT-4 Turbo',
  'GPT-3.5 Turbo',
  'Claude 3 Opus',
  'Claude 3 Sonnet',
  'Claude 3 Haiku',
  'Gemini Pro',
  'Gemini Ultra',
  'PaLM 2',
  'Llama 3',
  'Mistral Large',
  'Custom Model'
];

const heuristics: { value: HeuristicType; label: string; description: string }[] = [
  {
    value: 'anchoring',
    label: 'Anchoring Bias',
    description: 'Over-reliance on the first piece of information presented'
  },
  {
    value: 'loss_aversion',
    label: 'Loss Aversion',
    description: 'Asymmetric treatment of gains versus losses'
  },
  {
    value: 'confirmation',
    label: 'Confirmation Bias',
    description: 'Tendency to seek information confirming existing beliefs'
  },
  {
    value: 'sunk_cost',
    label: 'Sunk Cost Fallacy',
    description: 'Continuing commitment based on past investment'
  }
];

export const ConfigurationPanel = ({ onStartEvaluation, isRunning }: ConfigurationPanelProps) => {
  const [systemName, setSystemName] = useState('GPT-4');
  const [customSystemName, setCustomSystemName] = useState('');
  const [iterations, setIterations] = useState(100);
  const [selectedHeuristics, setSelectedHeuristics] = useState<HeuristicType[]>([
    'anchoring',
    'loss_aversion',
    'confirmation'
  ]);

  const handleHeuristicToggle = (heuristic: HeuristicType) => {
    setSelectedHeuristics(prev =>
      prev.includes(heuristic)
        ? prev.filter(h => h !== heuristic)
        : [...prev, heuristic]
    );
  };

  const handleStart = () => {
    if (selectedHeuristics.length > 0) {
      const finalSystemName = systemName === 'Custom Model' && customSystemName 
        ? customSystemName 
        : systemName;
      onStartEvaluation({ selectedHeuristics, iterations, systemName: finalSystemName });
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-2">
          Evaluation Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure heuristic tests and baseline parameters
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="systemName" className="text-sm font-medium text-card-foreground">
            AI System Identifier
          </Label>
          <Select value={systemName} onValueChange={setSystemName} disabled={isRunning}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select AI system..." />
            </SelectTrigger>
            <SelectContent>
              {aiSystems.map((system) => (
                <SelectItem key={system} value={system}>
                  {system}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {systemName === 'Custom Model' && (
            <Input
              placeholder="Enter custom AI system name..."
              value={customSystemName}
              onChange={(e) => setCustomSystemName(e.target.value)}
              className="mt-2"
              disabled={isRunning}
            />
          )}
        </div>

        <div>
          <Label htmlFor="iterations" className="text-sm font-medium text-card-foreground">
            Test Iterations
          </Label>
          <Input
            id="iterations"
            type="number"
            min={10}
            max={1000}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            className="mt-1.5"
            disabled={isRunning}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Higher iterations improve statistical reliability (recommended: 100+)
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-sm font-medium text-card-foreground">
              Heuristic Tests
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Select cognitive heuristics to test. Each represents a specific decision-making shortcut that may introduce bias.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-3">
            {heuristics.map(({ value, label, description }) => (
              <div key={value} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={value}
                  checked={selectedHeuristics.includes(value)}
                  onCheckedChange={() => handleHeuristicToggle(value)}
                  disabled={isRunning}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={value}
                    className="text-sm font-medium text-card-foreground cursor-pointer"
                  >
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={handleStart}
          disabled={isRunning || selectedHeuristics.length === 0}
          className="w-full"
          size="lg"
        >
          <Play className="w-4 h-4 mr-2" />
          {isRunning ? 'Analysis Running...' : 'Start Diagnostic Analysis'}
        </Button>

        {selectedHeuristics.length === 0 && (
          <p className="text-sm text-danger text-center">
            Please select at least one heuristic to test
          </p>
        )}
      </div>
    </Card>
  );
};
