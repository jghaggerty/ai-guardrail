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
import { ArrowLeft, Plus, Pencil, Trash2, Bot, TestTube, CheckCircle2, XCircle, Eye, EyeOff, Key, Loader2, Wifi, WifiOff, Clock, CalendarClock, Play } from 'lucide-react';
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
  schedule_frequency: string | null;
  last_evaluated_at: string | null;
}

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: 'Manual Only' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

interface EvaluationSettings {
  id: string;
  test_suites: string[];
  sample_size: number;
  temperature: number;
  confidence_interval: number;
}

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'DeepSeek', 'Azure', 'AWS Bedrock', 'Custom'];
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  'OpenAI': ['gpt-5', 'gpt-4.5-preview', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  'Anthropic': ['claude-opus-4-5-20251101', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  'Google': ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
  'Meta': ['llama-4-scout', 'llama-4-maverick', 'llama-3.1-405b', 'llama-3.1-70b', 'llama-3.1-8b'],
  'DeepSeek': ['deepseek-v3', 'deepseek-r1', 'deepseek-coder'],
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
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [runningEvaluation, setRunningEvaluation] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [llmForm, setLlmForm] = useState({
    display_name: '',
    provider: 'OpenAI',
    model_name: 'gpt-4',
    model_version: '',
    base_url: '',
    environment: 'development',
    api_key: '',
    schedule_frequency: 'manual'
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
            // Fetch last evaluation times for each config
            const configNames = configs.map(c => c.display_name);
            const { data: lastEvals } = await supabase
              .from('evaluations')
              .select('ai_system_name, completed_at')
              .in('ai_system_name', configNames)
              .eq('status', 'completed')
              .order('completed_at', { ascending: false });

            // Build map of last evaluation times
            const lastEvalMap = new Map<string, string>();
            if (lastEvals) {
              for (const evalRecord of lastEvals) {
                if (!lastEvalMap.has(evalRecord.ai_system_name) && evalRecord.completed_at) {
                  lastEvalMap.set(evalRecord.ai_system_name, evalRecord.completed_at);
                }
              }
            }

            // Map data to include schedule_frequency and last_evaluated_at
            setLlmConfigs(configs.map(config => ({
              ...config,
              schedule_frequency: (config as any).schedule_frequency || 'manual',
              last_evaluated_at: lastEvalMap.get(config.display_name!) || null
            })));
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
      environment: 'development',
      api_key: '',
      schedule_frequency: 'manual'
    });
    setEditingLLM(null);
    setShowApiKey(false);
  };

  const handleEditLLM = (config: LLMConfig) => {
    setEditingLLM(config);
    setLlmForm({
      display_name: config.display_name,
      provider: config.provider,
      model_name: config.model_name,
      model_version: config.model_version || '',
      base_url: config.base_url || '',
      environment: config.environment || 'development',
      api_key: '', // Never pre-fill API key for security
      schedule_frequency: config.schedule_frequency || 'manual'
    });
    setShowApiKey(false);
    setIsLLMDialogOpen(true);
  };

  const storeApiKey = async (configId: string, apiKey: string): Promise<boolean> => {
    if (!apiKey || !teamId) return true; // Skip if no API key provided
    
    setSavingApiKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('store-api-key', {
        body: { configId, apiKey, teamId }
      });

      if (response.error) throw response.error;
      return true;
    } catch (error) {
      console.error('Error storing API key:', error);
      toast.error('Failed to store API key securely');
      return false;
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleTestConnection = async (configId: string) => {
    setTestingConnection(configId);
    try {
      const response = await supabase.functions.invoke('test-connection', {
        body: { configId }
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result.success) {
        toast.success('Connection successful!');
        // Update local state
        setLlmConfigs(prev => prev.map(c => 
          c.id === configId ? { ...c, is_connected: true } : c
        ));
      } else {
        toast.error(`Connection failed: ${result.message}`);
        setLlmConfigs(prev => prev.map(c => 
          c.id === configId ? { ...c, is_connected: false } : c
        ));
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Failed to test connection');
    } finally {
      setTestingConnection(null);
    }
  };

  const handleRunEvaluation = async (config: LLMConfig) => {
    if (!teamId || !user) return;
    
    setRunningEvaluation(config.id);
    try {
      // Get evaluation settings for the team
      const heuristicTypes = evalSettings?.test_suites || ['cognitive_bias'];
      const iterationCount = evalSettings?.sample_size || 100;

      // Create evaluation record
      const { data: evaluation, error: createError } = await supabase
        .from('evaluations')
        .insert({
          ai_system_name: config.display_name,
          heuristic_types: ['anchoring', 'loss_aversion', 'confirmation_bias'],
          iteration_count: iterationCount,
          status: 'pending',
          team_id: teamId,
          user_id: user.id
        })
        .select()
        .single();

      if (createError) throw createError;

      // Trigger the evaluate function
      const response = await supabase.functions.invoke('evaluate', {
        body: {
          evaluation_id: evaluation.id,
          ai_system_name: config.display_name,
          heuristic_types: ['anchoring', 'loss_aversion', 'confirmation_bias'],
          iteration_count: iterationCount,
          llm_config_id: config.id
        }
      });

      if (response.error) throw response.error;

      toast.success(`Evaluation started for ${config.display_name}`);
      
      // Update last_evaluated_at in local state
      setLlmConfigs(prev => prev.map(c => 
        c.id === config.id 
          ? { ...c, last_evaluated_at: new Date().toISOString() }
          : c
      ));
    } catch (error) {
      console.error('Error running evaluation:', error);
      toast.error('Failed to start evaluation');
    } finally {
      setRunningEvaluation(null);
    }
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
            is_connected: !!llmForm.api_key || editingLLM.is_connected,
            schedule_frequency: llmForm.schedule_frequency,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingLLM.id);

        if (error) throw error;

        // Store API key if provided
        if (llmForm.api_key) {
          const success = await storeApiKey(editingLLM.id, llmForm.api_key);
          if (!success) return;
        }
        
        setLlmConfigs(prev => prev.map(c => 
          c.id === editingLLM.id 
            ? { 
                ...c, 
                ...llmForm, 
                model_version: llmForm.model_version || null, 
                base_url: llmForm.base_url || null,
                is_connected: !!llmForm.api_key || c.is_connected,
                schedule_frequency: llmForm.schedule_frequency
              }
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
            is_connected: !!llmForm.api_key,
            schedule_frequency: llmForm.schedule_frequency
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          // Store API key if provided
          if (llmForm.api_key) {
            const success = await storeApiKey(data.id, llmForm.api_key);
            if (!success) {
              // Rollback: delete the config if API key storage failed
              await supabase.from('llm_configurations').delete().eq('id', data.id);
              return;
            }
          }
          
          setLlmConfigs(prev => [...prev, { ...data, is_connected: !!llmForm.api_key, schedule_frequency: llmForm.schedule_frequency, last_evaluated_at: null }]);
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
            <Link to="/dashboard">
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
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        API Key {editingLLM?.is_connected && '(leave blank to keep existing)'}
                      </Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder={editingLLM?.is_connected ? '••••••••••••••••' : 'Enter your API key'}
                          value={llmForm.api_key}
                          onChange={(e) => setLlmForm(prev => ({ ...prev, api_key: e.target.value }))}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your API key is encrypted with AES-256-GCM before storage
                      </p>
                    </div>
                    <Button 
                      onClick={handleSaveLLM} 
                      className="w-full" 
                      disabled={!llmForm.display_name || !llmForm.model_name || savingApiKey}
                    >
                      {savingApiKey ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Securing API Key...
                        </>
                      ) : (
                        <>{editingLLM ? 'Update' : 'Add'} Model</>
                      )}
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
                            {config.schedule_frequency && config.schedule_frequency !== 'manual' && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {SCHEDULE_OPTIONS.find(o => o.value === config.schedule_frequency)?.label || config.schedule_frequency}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{config.provider} • {config.model_name}{config.model_version && ` • ${config.model_version}`}</span>
                            {config.last_evaluated_at && (
                              <span className="flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" />
                                Last evaluated: {new Date(config.last_evaluated_at).toLocaleDateString()}
                              </span>
                            )}
                            {!config.last_evaluated_at && (
                              <span className="text-muted-foreground/60">Never evaluated</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="default" 
                          size="sm" 
                          onClick={() => handleRunEvaluation(config)}
                          disabled={runningEvaluation === config.id || !config.is_connected}
                          title={!config.is_connected ? 'Connect API key first' : 'Run evaluation now'}
                        >
                          {runningEvaluation === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Play className="w-4 h-4 mr-1" />
                          )}
                          Run Now
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleTestConnection(config.id)}
                          disabled={testingConnection === config.id || !config.is_connected}
                          title={!config.is_connected ? 'Add an API key first' : 'Test connection'}
                        >
                          {testingConnection === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wifi className="w-4 h-4" />
                          )}
                        </Button>
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
