import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeuristicType } from '@/types/bias';
import { Play, Info, Settings, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface ConfigurationPanelProps {
  onStartEvaluation: (config: {
    selectedHeuristics: HeuristicType[];
    iterations: number;
    systemName: string;
  }) => void;
  isRunning: boolean;
}

interface LLMConfig {
  id: string;
  display_name: string;
  provider: string;
  model_name: string;
  is_connected: boolean;
}

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
  const { user } = useAuth();
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemName, setSystemName] = useState('');
  const [iterations, setIterations] = useState(100);
  const [selectedHeuristics, setSelectedHeuristics] = useState<HeuristicType[]>([
    'anchoring',
    'loss_aversion',
    'confirmation'
  ]);

  useEffect(() => {
    const fetchLLMConfigs = async () => {
      if (!user) return;

      try {
        // Get user's team_id from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', user.id)
          .single();

        if (profile?.team_id) {
          const { data: configs } = await supabase
            .from('llm_configurations')
            .select('id, display_name, provider, model_name, is_connected')
            .eq('team_id', profile.team_id);

          if (configs && configs.length > 0) {
            setLlmConfigs(configs);
            // Set the first connected config as default
            const firstConnected = configs.find(c => c.is_connected) || configs[0];
            setSystemName(firstConnected.display_name);
          }
        }
      } catch (error) {
        console.error('Error fetching LLM configs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLLMConfigs();
  }, [user]);

  const handleHeuristicToggle = (heuristic: HeuristicType) => {
    setSelectedHeuristics(prev =>
      prev.includes(heuristic)
        ? prev.filter(h => h !== heuristic)
        : [...prev, heuristic]
    );
  };

  const handleStart = () => {
    if (selectedHeuristics.length > 0 && systemName) {
      onStartEvaluation({ selectedHeuristics, iterations, systemName });
    }
  };

  const hasNoConfigs = !loading && llmConfigs.length === 0;

  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-card-foreground mb-2">
            Evaluation Configuration
          </h3>
          <Link to="/settings">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure heuristic tests and baseline parameters
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="systemName" className="text-sm font-medium text-card-foreground">
            AI System Identifier
          </Label>
          {loading ? (
            <div className="mt-1.5 h-10 bg-muted animate-pulse rounded-md" />
          ) : hasNoConfigs ? (
            <div className="mt-1.5 p-4 border border-dashed border-border rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No AI models configured yet
              </p>
              <Link to="/settings">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add AI Model
                </Button>
              </Link>
            </div>
          ) : (
            <Select value={systemName} onValueChange={setSystemName} disabled={isRunning}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select AI system..." />
              </SelectTrigger>
              <SelectContent>
                {llmConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.display_name}>
                    <div className="flex items-center gap-2">
                      <span>{config.display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({config.provider})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          disabled={isRunning || selectedHeuristics.length === 0 || !systemName || hasNoConfigs}
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
