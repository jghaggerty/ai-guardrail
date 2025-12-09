import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Rocket, Building2, Bot, Brain, Calendar, Check, Clock, FileText } from 'lucide-react';

export function SummaryStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [startingEvaluation, setStartingEvaluation] = useState(false);

  const selectedLLMs = data.llmConfigs.filter(c => c.isSelected);
  const connectedLLMs = selectedLLMs.filter(c => c.isConnected);

  const handleBack = () => setStep('automation');

  const saveOnboardingData = async () => {
    try {
      // Get team_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;
      const teamId = profile.team_id;

      // Update team with organization info
      await supabase
        .from('teams')
        .update({
          name: data.companyName,
          company_size: data.companySize,
          industry: data.industry,
          headquarters_country: data.headquartersCountry,
          headquarters_state: data.headquartersState || null,
          dpa_accepted_at: new Date().toISOString(),
          dpa_version: '1.0',
          billing_email: data.useSameEmailForBilling ? data.email : data.billingEmail,
          billing_contact_name: data.useSameEmailForBilling ? data.fullName : data.billingContactName,
        })
        .eq('id', teamId);

      // Update profile
      await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          job_title: data.jobTitle,
          tos_accepted_at: new Date().toISOString(),
          onboarding_completed: true,
        })
        .eq('id', user!.id);

      // Save team invitations
      if (data.teamInvites.length > 0) {
        await supabase
          .from('team_invitations')
          .insert(data.teamInvites.map(inv => ({
            team_id: teamId,
            email: inv.email,
            role: inv.role,
            invited_by: user!.id,
          })));
      }

      // Save LLM configurations
      for (const config of selectedLLMs) {
        // First upsert the config without the API key
        const { data: savedConfig, error: configError } = await supabase
          .from('llm_configurations')
          .upsert({
            team_id: teamId,
            user_id: user!.id,
            provider: config.provider,
            model_name: config.modelName,
            display_name: config.displayName,
            model_version: config.modelVersion || null,
            base_url: config.baseUrl || null,
            environment: config.environment,
            is_connected: config.isConnected,
          }, { onConflict: 'team_id,provider,model_name' })
          .select('id')
          .single();

        if (configError) {
          console.error('Error saving LLM config:', configError);
          continue;
        }

        // If there's an API key, securely store it via Edge Function
        if (config.apiKey && savedConfig?.id) {
          try {
            const { error: storeError } = await supabase.functions.invoke('store-api-key', {
              body: {
                configId: savedConfig.id,
                apiKey: config.apiKey,
                teamId: teamId,
              }
            });
            
            if (storeError) {
              console.error('Error storing API key securely:', storeError);
              toast({ 
                title: 'Warning', 
                description: `Could not securely store API key for ${config.displayName}. You can add it later in Settings.`,
                variant: 'destructive'
              });
            }
          } catch (err) {
            console.error('Error invoking store-api-key function:', err);
          }
        }
      }

      // Save evaluation settings
      await supabase
        .from('evaluation_settings')
        .upsert({
          team_id: teamId,
          test_suites: data.testSuites,
          protected_attributes: data.protectedAttributes,
          sample_size: data.sampleSize,
          confidence_interval: data.confidenceInterval,
          temperature: data.temperature,
          keep_temperature_constant: data.keepTemperatureConstant,
          schedule_frequency: data.scheduleFrequency,
          alert_threshold: data.alertThreshold,
          alert_emails: data.alertEmails,
          report_emails: data.reportEmails,
        }, { onConflict: 'team_id' });

      return true;
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const handleStartEvaluation = async () => {
    if (!data.dataProcessingConfirmed || !data.methodologyRead) {
      toast({ title: 'Required', description: 'Please confirm both checkboxes before continuing', variant: 'destructive' });
      return;
    }

    setStartingEvaluation(true);
    const success = await saveOnboardingData();
    
    if (success) {
      toast({ title: 'Starting Evaluation', description: 'Your first bias evaluation is now running!' });
      setStep('complete');
      navigate('/', { replace: true });
    }
    setStartingEvaluation(false);
  };

  const handleSkipEvaluation = async () => {
    setLoading(true);
    const success = await saveOnboardingData();
    
    if (success) {
      toast({ title: 'Setup Complete', description: 'You can start your first evaluation from the dashboard.' });
      setStep('complete');
      navigate('/', { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Almost There — Review Your Setup</h1>
        <p className="text-muted-foreground mt-1">
          Your first evaluation establishes a baseline to detect bias drift over time
        </p>
      </div>

      {/* Setup Summary */}
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
        {/* Organization */}
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Organization</p>
            <p className="text-sm text-muted-foreground">{data.companyName}</p>
          </div>
          <Check className="h-5 w-5 text-success" />
        </div>

        {/* LLMs */}
        <div className="flex items-start gap-3">
          <Bot className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">LLMs Selected</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedLLMs.map(llm => (
                <Badge key={llm.id} variant={llm.isConnected ? 'default' : 'secondary'} className="text-xs">
                  {llm.isConnected && <Check className="h-3 w-3 mr-1" />}
                  {llm.displayName}
                </Badge>
              ))}
            </div>
            {connectedLLMs.length < selectedLLMs.length && (
              <p className="text-xs text-warning mt-1">
                {connectedLLMs.length} of {selectedLLMs.length} connected — configure API keys to run evaluations
              </p>
            )}
          </div>
        </div>

        {/* Test Suite */}
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Test Suite</p>
            <p className="text-sm text-muted-foreground">
              Cognitive Bias Heuristic Tests • {data.protectedAttributes.length} fairness dimensions
            </p>
          </div>
          <Check className="h-5 w-5 text-success" />
        </div>

        {/* Schedule */}
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Automation</p>
            <p className="text-sm text-muted-foreground capitalize">
              {data.scheduleFrequency === 'manual' ? 'Manual runs only' : `${data.scheduleFrequency} evaluations`}
            </p>
          </div>
          <Check className="h-5 w-5 text-success" />
        </div>

        {/* Estimated Time */}
        <div className="flex items-start gap-3 pt-2 border-t border-border">
          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">
              Estimated time for first run: <strong>15-25 minutes</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Confirmations */}
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="dpaConfirm"
            checked={data.dataProcessingConfirmed}
            onCheckedChange={(checked) => updateData({ dataProcessingConfirmed: checked as boolean })}
          />
          <label htmlFor="dpaConfirm" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
            I confirm this data will be processed according to our Data Processing Agreement
          </label>
        </div>
        <div className="flex items-start space-x-3">
          <Checkbox
            id="methodologyConfirm"
            checked={data.methodologyRead}
            onCheckedChange={(checked) => updateData({ methodologyRead: checked as boolean })}
          />
          <label htmlFor="methodologyConfirm" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
            I've reviewed the{' '}
            <a href="#" className="text-primary hover:underline">evaluation methodology documentation</a>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={handleStartEvaluation}
          className="w-full"
          size="lg"
          disabled={startingEvaluation || !data.dataProcessingConfirmed || !data.methodologyRead || connectedLLMs.length === 0}
        >
          {startingEvaluation ? (
            'Starting Evaluation...'
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Start My First Evaluation Now
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleSkipEvaluation}
          className="w-full"
          disabled={loading}
        >
          <FileText className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Complete Setup — Start Later from Dashboard'}
        </Button>
      </div>

      <Button variant="ghost" onClick={handleBack} className="w-full text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Edit Settings
      </Button>
    </div>
  );
}
