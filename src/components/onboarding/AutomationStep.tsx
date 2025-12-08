import { useState } from 'react';
import { useOnboarding } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Clock, Play, AlertTriangle, Plus, X, Bell, DollarSign } from 'lucide-react';
import { z } from 'zod';

const FREQUENCIES: Array<{
  value: string;
  label: string;
  icon: typeof Play;
  description: string;
  recommended?: string;
  badge?: string;
  warning?: string;
}> = [
  { value: 'manual', label: 'Manual Only', icon: Play, description: "I'll run tests on-demand", recommended: 'First-time setup' },
  { value: 'monthly', label: 'Monthly', icon: Calendar, description: '1st of each month at 2 AM UTC', badge: 'Most Popular', recommended: 'Production monitoring' },
  { value: 'biweekly', label: 'Bi-Weekly', icon: Calendar, description: 'Every 2 weeks', recommended: 'Active development' },
  { value: 'weekly', label: 'Weekly', icon: Calendar, description: 'Every Monday at 2 AM UTC', recommended: 'High-velocity teams' },
  { value: 'daily', label: 'Daily', icon: Clock, description: 'Every day at 2 AM UTC', warning: 'Higher API costs' },
  { value: 'hourly', label: 'Hourly', icon: Clock, description: 'Every hour', warning: 'Very high API usage' },
];

const ALERT_THRESHOLDS = [
  { value: 'conservative', label: 'Conservative (10%)', description: 'Alert on any significant change' },
  { value: 'moderate', label: 'Moderate (25%)', description: 'Balanced sensitivity' },
  { value: 'aggressive', label: 'Aggressive (40%)', description: 'Only major changes' },
];

const emailSchema = z.string().email();

export function AutomationStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { toast } = useToast();
  
  const [newAlertEmail, setNewAlertEmail] = useState('');
  const [newReportEmail, setNewReportEmail] = useState('');

  const selectedLLMs = data.llmConfigs.filter(c => c.isSelected);
  
  // Estimate costs (rough estimates for demo)
  const getEstimatedCost = () => {
    const costPerLLM = 0.50; // $ per evaluation run
    const runsPerMonth = {
      manual: 0,
      hourly: 720,
      daily: 30,
      weekly: 4,
      biweekly: 2,
      monthly: 1,
    };
    const runs = runsPerMonth[data.scheduleFrequency];
    const total = runs * selectedLLMs.length * costPerLLM;
    return { runs, total };
  };

  const cost = getEstimatedCost();

  const handleAddEmail = (type: 'alert' | 'report') => {
    const email = type === 'alert' ? newAlertEmail : newReportEmail;
    const result = emailSchema.safeParse(email);
    
    if (!result.success) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    if (type === 'alert') {
      if (data.alertEmails.includes(email)) {
        toast({ title: 'Duplicate', description: 'This email is already in the list', variant: 'destructive' });
        return;
      }
      updateData({ alertEmails: [...data.alertEmails, email] });
      setNewAlertEmail('');
    } else {
      if (data.reportEmails.includes(email)) {
        toast({ title: 'Duplicate', description: 'This email is already in the list', variant: 'destructive' });
        return;
      }
      updateData({ reportEmails: [...data.reportEmails, email] });
      setNewReportEmail('');
    }
  };

  const handleRemoveEmail = (email: string, type: 'alert' | 'report') => {
    if (type === 'alert') {
      updateData({ alertEmails: data.alertEmails.filter(e => e !== email) });
    } else {
      updateData({ reportEmails: data.reportEmails.filter(e => e !== email) });
    }
  };

  const handleBack = () => setStep('test-suite');
  const handleNext = () => setStep('summary');

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Calendar className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">When Should We Evaluate Your LLMs?</h1>
        <p className="text-muted-foreground mt-1">
          Set up automated monitoring to catch bias drift over time
        </p>
      </div>

      {/* Frequency Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FREQUENCIES.map(freq => (
          <button
            key={freq.value}
            onClick={() => updateData({ scheduleFrequency: freq.value as typeof data.scheduleFrequency })}
            className={`
              relative p-3 rounded-lg border text-left transition-all
              ${data.scheduleFrequency === freq.value
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/50'
              }
            `}
          >
            {freq.badge && (
              <Badge className="absolute -top-2 -right-2 text-[10px]">{freq.badge}</Badge>
            )}
            <freq.icon className={`h-5 w-5 mb-2 ${data.scheduleFrequency === freq.value ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="font-medium text-sm">{freq.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{freq.description}</p>
            {freq.warning && (
              <p className="text-xs text-warning flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" /> {freq.warning}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Cost Estimation */}
      {data.scheduleFrequency !== 'manual' && (
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">Estimated API Cost</p>
            <p className="text-muted-foreground">
              At <strong>{data.scheduleFrequency}</strong> frequency with <strong>{selectedLLMs.length}</strong> LLM{selectedLLMs.length !== 1 ? 's' : ''}, 
              approximately <strong>${cost.total.toFixed(2)}/month</strong> ({cost.runs} runs × {selectedLLMs.length} models)
            </p>
          </div>
        </div>
      )}

      {/* Notifications */}
      {data.scheduleFrequency !== 'manual' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Notifications & Alerts</h3>
          </div>

          {/* Alert Threshold */}
          <div className="space-y-2">
            <Label>Alert Threshold</Label>
            <Select
              value={data.alertThreshold}
              onValueChange={(value) => updateData({ alertThreshold: value as typeof data.alertThreshold })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {ALERT_THRESHOLDS.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span>{t.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alert Emails */}
          <div className="space-y-2">
            <Label>Alert Recipients</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@company.com"
                value={newAlertEmail}
                onChange={(e) => setNewAlertEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail('alert')}
              />
              <Button variant="outline" size="icon" onClick={() => handleAddEmail('alert')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {data.alertEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.alertEmails.map(email => (
                  <Badge key={email} variant="secondary" className="pr-1">
                    {email}
                    <button onClick={() => handleRemoveEmail(email, 'alert')} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Report Emails */}
          <div className="space-y-2">
            <Label>Report Recipients</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@company.com"
                value={newReportEmail}
                onChange={(e) => setNewReportEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail('report')}
              />
              <Button variant="outline" size="icon" onClick={() => handleAddEmail('report')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {data.reportEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.reportEmails.map(email => (
                  <Badge key={email} variant="secondary" className="pr-1">
                    {email}
                    <button onClick={() => handleRemoveEmail(email, 'report')} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} className="flex-1" size="lg">
          Review & Launch
        </Button>
      </div>
    </div>
  );
}
