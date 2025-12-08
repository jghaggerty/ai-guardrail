import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Building2, ChevronDown, HelpCircle } from 'lucide-react';
import { z } from 'zod';

const COMPANY_SIZES = [
  { value: '1-50', label: '1-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1001-5000', label: '1001-5000 employees' },
  { value: '5000+', label: '5000+ employees' },
];

const INDUSTRIES = [
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'hr_talent', label: 'HR/Talent' },
  { value: 'technology', label: 'Technology/SaaS' },
  { value: 'education', label: 'Education' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japan' },
  { value: 'SG', label: 'Singapore' },
  { value: 'OTHER', label: 'Other' },
];

const orgSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  companySize: z.string().min(1, 'Please select company size'),
  headquartersCountry: z.string().min(1, 'Please select country'),
});

export function OrganizationStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showWhyInfo, setShowWhyInfo] = useState(false);

  const handleIndustryToggle = (value: string) => {
    const current = data.industry || [];
    const updated = current.includes(value)
      ? current.filter(i => i !== value)
      : [...current, value];
    updateData({ industry: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = orgSchema.safeParse({
      companyName: data.companyName,
      companySize: data.companySize,
      headquartersCountry: data.headquartersCountry,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (data.industry.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one industry', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Update team with organization info
      const { error: teamError } = await supabase
        .from('teams')
        .update({
          name: data.companyName,
          company_size: data.companySize,
          industry: data.industry,
          headquarters_country: data.headquartersCountry,
          headquarters_state: data.headquartersState || null,
          dpa_accepted_at: new Date().toISOString(),
          dpa_version: '1.0',
        })
        .eq('id', (await supabase.from('profiles').select('team_id').eq('id', user!.id).single()).data?.team_id);

      if (teamError) throw teamError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          job_title: data.jobTitle,
          tos_accepted_at: new Date().toISOString(),
          onboarding_completed: true,
        })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      toast({ title: 'Setup Complete', description: 'Welcome to the AI Bias Diagnostic Tool!' });
      setStep('complete');
      navigate('/', { replace: true });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Tell Us About Your Organization</h1>
        <p className="text-muted-foreground mt-1">
          This helps us customize test suites and ensure regulatory compliance
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            placeholder="Acme Corporation"
            value={data.companyName}
            onChange={(e) => updateData({ companyName: e.target.value })}
            className={errors.companyName ? 'border-destructive' : ''}
          />
          {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companySize">Company Size</Label>
            <Select value={data.companySize} onValueChange={(value) => updateData({ companySize: value })}>
              <SelectTrigger className={errors.companySize ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map(size => (
                  <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.companySize && <p className="text-xs text-destructive">{errors.companySize}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Headquarters Country</Label>
            <Select value={data.headquartersCountry} onValueChange={(value) => updateData({ headquartersCountry: value })}>
              <SelectTrigger className={errors.headquartersCountry ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(country => (
                  <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.headquartersCountry && <p className="text-xs text-destructive">{errors.headquartersCountry}</p>}
          </div>
        </div>

        {data.headquartersCountry === 'US' && (
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              placeholder="California"
              value={data.headquartersState}
              onChange={(e) => updateData({ headquartersState: e.target.value })}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Industry / Sector</Label>
          <p className="text-xs text-muted-foreground mb-2">Select all that apply</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {INDUSTRIES.map(industry => (
              <div key={industry.value} className="flex items-center space-x-2">
                <Checkbox
                  id={industry.value}
                  checked={data.industry?.includes(industry.value) || false}
                  onCheckedChange={() => handleIndustryToggle(industry.value)}
                />
                <label htmlFor={industry.value} className="text-sm cursor-pointer">
                  {industry.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Collapsible open={showWhyInfo} onOpenChange={setShowWhyInfo}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-4 w-4" />
            Why do we ask this?
            <ChevronDown className={`h-4 w-4 transition-transform ${showWhyInfo ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <ul className="space-y-1 list-disc list-inside">
              <li>Company size helps us tailor feature recommendations and support</li>
              <li>Industry selection enables domain-specific test suite recommendations</li>
              <li>Location data ensures compliance with regional regulations (GDPR, EU AI Act)</li>
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Completing Setup...' : 'Complete Setup — Start Evaluating'}
      </Button>
    </form>
  );
}
