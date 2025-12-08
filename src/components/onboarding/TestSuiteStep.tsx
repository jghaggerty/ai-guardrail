import { useState, useEffect } from 'react';
import { useOnboarding } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, ChevronDown, ExternalLink, Lightbulb, Clock, Target } from 'lucide-react';

const TEST_SUITES = [
  {
    id: 'cognitive_bias',
    name: 'Cognitive Bias Heuristic Tests',
    description: 'Evaluate decision-making quality using behavioral psychology tests',
    biases: ['Anchoring', 'Framing', 'Confirmation Bias', 'Availability Bias', 'Omission Bias'],
    testCases: '~500 scenarios',
    runtime: '10-15 min per LLM',
    recommended: true,
  },
];

const PROTECTED_ATTRIBUTES = {
  demographics: [
    { id: 'gender', label: 'Gender' },
    { id: 'age', label: 'Age' },
    { id: 'race_ethnicity', label: 'Race/Ethnicity' },
    { id: 'disability', label: 'Disability Status' },
    { id: 'religion', label: 'Religion' },
  ],
  context: [
    { id: 'geographic', label: 'Geographic Location' },
    { id: 'socioeconomic', label: 'Socioeconomic Status' },
    { id: 'job_type', label: 'Job Type' },
  ],
  healthcare: [
    { id: 'medical_specialty', label: 'Medical Specialty' },
    { id: 'patient_age', label: 'Patient Age Groups' },
    { id: 'language', label: 'Language' },
  ],
  finance: [
    { id: 'credit_history', label: 'Credit History' },
    { id: 'employment_type', label: 'Employment Type' },
    { id: 'income_level', label: 'Income Level' },
  ],
  hr: [
    { id: 'education', label: 'Education Background' },
    { id: 'protected_class', label: 'Protected Class' },
    { id: 'veteran_status', label: 'Veteran Status' },
  ],
};

const INDUSTRY_DEFAULTS: Record<string, string[]> = {
  healthcare: ['gender', 'age', 'socioeconomic', 'medical_specialty'],
  financial_services: ['age', 'race_ethnicity', 'employment_type', 'geographic'],
  hr_talent: ['gender', 'age', 'race_ethnicity', 'education'],
  insurance: ['age', 'geographic', 'socioeconomic', 'disability'],
};

export function TestSuiteStep() {
  const { data, updateData, setStep } = useOnboarding();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Set industry-specific defaults on mount
  useEffect(() => {
    if (data.protectedAttributes.length === 0 && data.industry.length > 0) {
      const defaults = new Set<string>();
      data.industry.forEach(ind => {
        INDUSTRY_DEFAULTS[ind]?.forEach(attr => defaults.add(attr));
      });
      if (defaults.size > 0) {
        updateData({ protectedAttributes: Array.from(defaults) });
      }
    }
  }, []);

  const handleToggleAttribute = (id: string) => {
    const current = data.protectedAttributes;
    const updated = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id];
    updateData({ protectedAttributes: updated });
  };

  const handleBack = () => setStep('api-keys');
  const handleNext = () => setStep('automation');

  // Get domain-specific attributes based on industry
  const getDomainAttributes = () => {
    const attrs: typeof PROTECTED_ATTRIBUTES.healthcare = [];
    if (data.industry.includes('healthcare')) attrs.push(...PROTECTED_ATTRIBUTES.healthcare);
    if (data.industry.includes('financial_services') || data.industry.includes('insurance')) {
      attrs.push(...PROTECTED_ATTRIBUTES.finance);
    }
    if (data.industry.includes('hr_talent')) attrs.push(...PROTECTED_ATTRIBUTES.hr);
    return attrs;
  };

  const domainAttributes = getDomainAttributes();

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Choose Your Evaluation Test Suite</h1>
        <p className="text-muted-foreground mt-1">
          Configure which biases to test and fairness dimensions to evaluate
        </p>
      </div>

      {/* Test Suite Selection */}
      <div className="space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Test Suites
        </h3>
        {TEST_SUITES.map(suite => (
          <div
            key={suite.id}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              data.testSuites.includes(suite.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => {
              const updated = data.testSuites.includes(suite.id)
                ? data.testSuites.filter(s => s !== suite.id)
                : [...data.testSuites, suite.id];
              updateData({ testSuites: updated });
            }}
          >
            <div className="flex items-start gap-3">
              <Checkbox checked={data.testSuites.includes(suite.id)} className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{suite.name}</h4>
                  {suite.recommended && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{suite.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {suite.biases.map(bias => (
                    <Badge key={bias} variant="outline" className="text-xs">{bias}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" /> {suite.testCases}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {suite.runtime}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Protected Attributes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Fairness Dimensions
          </h3>
          <Badge variant="secondary">{data.protectedAttributes.length} selected</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Which demographic and contextual factors should we check for bias?
        </p>

        {data.industry.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-muted-foreground">
              Recommendations based on your industry ({data.industry.join(', ')}). Adjust as needed.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Demographics */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Demographics</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {PROTECTED_ATTRIBUTES.demographics.map(attr => (
                <div key={attr.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={attr.id}
                    checked={data.protectedAttributes.includes(attr.id)}
                    onCheckedChange={() => handleToggleAttribute(attr.id)}
                  />
                  <label htmlFor={attr.id} className="text-sm cursor-pointer">{attr.label}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Context */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Role/Context</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {PROTECTED_ATTRIBUTES.context.map(attr => (
                <div key={attr.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={attr.id}
                    checked={data.protectedAttributes.includes(attr.id)}
                    onCheckedChange={() => handleToggleAttribute(attr.id)}
                  />
                  <label htmlFor={attr.id} className="text-sm cursor-pointer">{attr.label}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Domain-specific */}
          {domainAttributes.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Domain-Specific</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {domainAttributes.map(attr => (
                  <div key={attr.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={attr.id}
                      checked={data.protectedAttributes.includes(attr.id)}
                      onCheckedChange={() => handleToggleAttribute(attr.id)}
                    />
                    <label htmlFor={attr.id} className="text-sm cursor-pointer">{attr.label}</label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Options */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          Advanced Options
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Sample Size per Test</Label>
              <span className="text-sm font-medium">{data.sampleSize}</span>
            </div>
            <Slider
              value={[data.sampleSize]}
              onValueChange={([value]) => updateData({ sampleSize: value })}
              min={100}
              max={1000}
              step={50}
            />
            <p className="text-xs text-muted-foreground">Higher = more accurate, longer runtime</p>
          </div>

          <div className="space-y-2">
            <Label>Confidence Interval</Label>
            <Select
              value={String(data.confidenceInterval)}
              onValueChange={(value) => updateData({ confidenceInterval: parseFloat(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="0.90">90%</SelectItem>
                <SelectItem value="0.95">95% (Recommended)</SelectItem>
                <SelectItem value="0.99">99%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="keepTemp"
                checked={data.keepTemperatureConstant}
                onCheckedChange={(checked) => updateData({ keepTemperatureConstant: checked as boolean })}
              />
              <label htmlFor="keepTemp" className="text-sm cursor-pointer">
                Keep temperature constant for reproducibility
              </label>
            </div>
            {data.keepTemperatureConstant && (
              <div className="ml-6 space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Temperature: {data.temperature}</Label>
                </div>
                <Slider
                  value={[data.temperature]}
                  onValueChange={([value]) => updateData({ temperature: value })}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="text-center">
        <a href="#" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Learn about test methodology
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
          disabled={data.testSuites.length === 0}
        >
          Next: Set Up Automation
        </Button>
      </div>
    </div>
  );
}
