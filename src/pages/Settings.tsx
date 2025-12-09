import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Pencil, Trash2, Bot, TestTube, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface LLMConfig {
  id: string;
  display_name: string;
  provider: string;
  model_name: string;
  model_version: string | null;
  base_url: string | null;
  is_connected: boolean;
  environment: string | null;
}

interface EvaluationSettings {
  id: string;
  test_suites: string[];
  sample_size: number;
  temperature: number;
  confidence_interval: number;
}

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Azure', 'AWS Bedrock', 'Custom'];
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  'OpenAI': ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
  'Anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  'Google': ['gemini-pro', 'gemini-ultra', 'palm-2'],
  'Azure': ['gpt-4', 'gpt-4-turbo', 'gpt-35-turbo'],
  'AWS Bedrock': ['anthropic.claude-3', 'amazon.titan', 'meta.llama3'],
  'Custom': []
};

const TEST_SUITE_OPTIONS = [
  { value: 'cognitive_bias', label: 'Cognitive Bias Detection' },
  { value: 'fairness', label: 'Fairness & Equity' },
  { value: 'robustness', label: 'Robustness Testing' },
  { value: 'consistency', label: 'Consistency Analysis' },
  { value: 'hallucination', label: 'Hallucination Detection' }
];

const Settings = () => {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);
  const [evalSettings, setEvalSettings] = useState<EvaluationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // LLM Form State
  const [isLLMDialogOpen, setIsLLMDialogOpen] = useState(false);
  const [editingLLM, setEditingLLM] = useState<LLMConfig | null>(null);
  const [llmForm, setLlmForm] = useState({
    display_name: '',
    provider: 'OpenAI',
    model_name: 'gpt-4',
    model_version: '',
    base_url: '',
    environment: 'development'
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', user.id)
          .single();

        if (profile?.team_id) {
          setTeamId(profile.team_id);

          // Fetch LLM configurations
          // Use safe view to avoid exposing encrypted API keys for reads
          const { data: configs } = await supabase
            .from('llm_configurations_safe')
            .select('*')
            .eq('team_id', profile.team_id);

          if (configs) {
            setLlmConfigs(configs);
          }

          // Fetch evaluation settings
          const { data: settings } = await supabase
            .from('evaluation_settings')
            .select('*')
            .eq('team_id', profile.team_id)
            .single();

          if (settings) {
            setEvalSettings(settings as EvaluationSettings);
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const resetLLMForm = () => {
    setLlmForm({
      display_name: '',
      provider: 'OpenAI',
      model_name: 'gpt-4',
      model_version: '',
      base_url: '',
      environment: 'development'
    });
    setEditingLLM(null);
  };

  const handleEditLLM = (config: LLMConfig) => {
    setEditingLLM(config);
    setLlmForm({
      display_name: config.display_name,
      provider: config.provider,
      model_name: config.model_name,
      model_version: config.model_version || '',
      base_url: config.base_url || '',
      environment: config.environment || 'development'
    });
    setIsLLMDialogOpen(true);
  };

  const handleSaveLLM = async () => {
    if (!teamId || !user) return;

    try {
      if (editingLLM) {
        // Update existing
        const { error } = await supabase
          .from('llm_configurations')
          .update({
            display_name: llmForm.display_name,
            provider: llmForm.provider,
            model_name: llmForm.model_name,
            model_version: llmForm.model_version || null,
            base_url: llmForm.base_url || null,
            environment: llmForm.environment,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingLLM.id);

        if (error) throw error;
        
        setLlmConfigs(prev => prev.map(c => 
          c.id === editingLLM.id 
            ? { ...c, ...llmForm, model_version: llmForm.model_version || null, base_url: llmForm.base_url || null }
            : c
        ));
        toast.success('LLM configuration updated');
      } else {
        // Create new
        const { data, error } = await supabase
          .from('llm_configurations')
          .insert({
            team_id: teamId,
            user_id: user.id,
            display_name: llmForm.display_name,
            provider: llmForm.provider,
            model_name: llmForm.model_name,
            model_version: llmForm.model_version || null,
            base_url: llmForm.base_url || null,
            environment: llmForm.environment,
            is_connected: false
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setLlmConfigs(prev => [...prev, data]);
          toast.success('LLM configuration added');
        }
      }

      setIsLLMDialogOpen(false);
      resetLLMForm();
    } catch (error) {
      console.error('Error saving LLM config:', error);
      toast.error('Failed to save configuration');
    }
  };

  const handleDeleteLLM = async (id: string) => {
    try {
      const { error } = await supabase
        .from('llm_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setLlmConfigs(prev => prev.filter(c => c.id !== id));
      toast.success('LLM configuration deleted');
    } catch (error) {
      console.error('Error deleting LLM config:', error);
      toast.error('Failed to delete configuration');
    }
  };

  const handleUpdateTestSuites = async (suites: string[]) => {
    if (!evalSettings) return;

    try {
      const { error } = await supabase
        .from('evaluation_settings')
        .update({ test_suites: suites, updated_at: new Date().toISOString() })
        .eq('id', evalSettings.id);

      if (error) throw error;
      
      setEvalSettings(prev => prev ? { ...prev, test_suites: suites } : null);
      toast.success('Test suites updated');
    } catch (error) {
      console.error('Error updating test suites:', error);
      toast.error('Failed to update test suites');
    }
  };

  const toggleTestSuite = (suite: string) => {
    if (!evalSettings) return;
    
    const current = evalSettings.test_suites || [];
    const updated = current.includes(suite)
      ? current.filter(s => s !== suite)
      : [...current, suite];
    
    handleUpdateTestSuites(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-card-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your AI models and test configurations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="models" className="space-y-6">
          <TabsList>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Models
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-2">
              <TestTube className="w-4 h-4" />
              Test Suites
            </TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">AI Model Configurations</h2>
                <p className="text-sm text-muted-foreground">Manage the AI models you want to evaluate</p>
              </div>
              <Dialog open={isLLMDialogOpen} onOpenChange={(open) => {
                setIsLLMDialogOpen(open);
                if (!open) resetLLMForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Model
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingLLM ? 'Edit' : 'Add'} AI Model</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Display Name</Label>
                      <Input
                        placeholder="e.g., Production GPT-4"
                        value={llmForm.display_name}
                        onChange={(e) => setLlmForm(prev => ({ ...prev, display_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select 
                        value={llmForm.provider} 
                        onValueChange={(value) => {
                          const models = MODELS_BY_PROVIDER[value] || [];
                          setLlmForm(prev => ({ 
                            ...prev, 
                            provider: value,
                            model_name: models[0] || ''
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Model</Label>
                      {llmForm.provider === 'Custom' ? (
                        <Input
                          placeholder="Enter model name"
                          value={llmForm.model_name}
                          onChange={(e) => setLlmForm(prev => ({ ...prev, model_name: e.target.value }))}
                        />
                      ) : (
                        <Select 
                          value={llmForm.model_name} 
                          onValueChange={(value) => setLlmForm(prev => ({ ...prev, model_name: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(MODELS_BY_PROVIDER[llmForm.provider] || []).map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Environment</Label>
                      <Select 
                        value={llmForm.environment} 
                        onValueChange={(value) => setLlmForm(prev => ({ ...prev, environment: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Custom Base URL (optional)</Label>
                      <Input
                        placeholder="https://api.example.com/v1"
                        value={llmForm.base_url}
                        onChange={(e) => setLlmForm(prev => ({ ...prev, base_url: e.target.value }))}
                      />
                    </div>
                    <Button onClick={handleSaveLLM} className="w-full" disabled={!llmForm.display_name || !llmForm.model_name}>
                      {editingLLM ? 'Update' : 'Add'} Model
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {llmConfigs.length === 0 ? (
              <Card className="p-8 text-center">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-card-foreground mb-2">No AI Models Configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first AI model to start running bias evaluations
                </p>
                <Button onClick={() => setIsLLMDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Model
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {llmConfigs.map((config) => (
                  <Card key={config.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-card-foreground">{config.display_name}</h3>
                            {config.is_connected ? (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Connected
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                Not Connected
                              </Badge>
                            )}
                            {config.environment && (
                              <Badge variant="outline">{config.environment}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {config.provider} • {config.model_name}
                            {config.model_version && ` • ${config.model_version}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditLLM(config)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteLLM(config.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tests" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Test Suite Configuration</h2>
              <p className="text-sm text-muted-foreground">Select which test suites to include in evaluations</p>
            </div>

            <Card className="p-6">
              <div className="space-y-4">
                {TEST_SUITE_OPTIONS.map((suite) => (
                  <div
                    key={suite.value}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => toggleTestSuite(suite.value)}
                  >
                    <div className="flex items-center gap-3">
                      <TestTube className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-medium text-card-foreground">{suite.label}</h3>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      evalSettings?.test_suites?.includes(suite.value)
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground'
                    }`}>
                      {evalSettings?.test_suites?.includes(suite.value) && (
                        <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {evalSettings && (
              <Card className="p-6">
                <h3 className="font-semibold text-card-foreground mb-4">Evaluation Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <Label className="text-xs text-muted-foreground">Sample Size</Label>
                    <p className="text-lg font-semibold text-card-foreground">{evalSettings.sample_size}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <Label className="text-xs text-muted-foreground">Temperature</Label>
                    <p className="text-lg font-semibold text-card-foreground">{evalSettings.temperature}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <Label className="text-xs text-muted-foreground">Confidence Interval</Label>
                    <p className="text-lg font-semibold text-card-foreground">{(evalSettings.confidence_interval * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
