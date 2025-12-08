import { useState } from 'react';
import { useOnboarding } from './OnboardingContext';
import { PasswordStrengthMeter, isPasswordValid } from './PasswordStrengthMeter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { z } from 'zod';

const JOB_TITLES = [
  'ML Engineer',
  'Product Manager',
  'Risk Officer',
  'Compliance Officer',
  'Data Scientist',
  'Researcher',
  'Engineering Manager',
  'Other',
];

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  fullName: z.string().min(2, 'Please enter your full name'),
  jobTitle: z.string().min(1, 'Please select your job title'),
});

export function SignUpStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { signUp } = useAuth();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const result = signUpSchema.safeParse({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      jobTitle: data.jobTitle,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }

    if (!isPasswordValid(data.password)) {
      setErrors({ password: 'Password does not meet all requirements' });
      return false;
    }

    if (data.password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return false;
    }

    if (!data.tosAccepted) {
      toast({ title: 'Error', description: 'Please accept the Terms of Service', variant: 'destructive' });
      return false;
    }

    if (!data.dpaAccepted) {
      toast({ title: 'Error', description: 'Please accept the Data Processing Agreement', variant: 'destructive' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    const { error } = await signUp(data.email, data.password);
    
    setLoading(false);

    if (error) {
      const message = error.message.includes('already registered')
        ? 'This email is already registered. Please sign in instead.'
        : error.message;
      toast({ title: 'Sign Up Failed', description: message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Account Created', description: 'Please check your email to verify your account.' });
    setStep('verify-email');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Create Your Account</h1>
        <p className="text-muted-foreground mt-1">
          Set up your account to evaluate generative AI systems for behavioral biases
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column - Credentials */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Account Credentials
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={data.email}
              onChange={(e) => updateData({ email: e.target.value })}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={data.password}
                onChange={(e) => updateData({ password: e.target.value })}
                className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            <PasswordStrengthMeter password={data.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>
        </div>

        {/* Right Column - Profile */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Professional Profile
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Jane Smith"
              value={data.fullName}
              onChange={(e) => updateData({ fullName: e.target.value })}
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title / Role</Label>
            <Select value={data.jobTitle} onValueChange={(value) => updateData({ jobTitle: value })}>
              <SelectTrigger className={errors.jobTitle ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                {JOB_TITLES.map(title => (
                  <SelectItem key={title} value={title}>{title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.jobTitle && <p className="text-xs text-destructive">{errors.jobTitle}</p>}
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="tos"
                checked={data.tosAccepted}
                onCheckedChange={(checked) => updateData({ tosAccepted: checked as boolean })}
              />
              <label htmlFor="tos" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{' '}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="dpa"
                checked={data.dpaAccepted}
                onCheckedChange={(checked) => updateData({ dpaAccepted: checked as boolean })}
              />
              <label htmlFor="dpa" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{' '}
                <a href="#" className="text-primary hover:underline">Data Processing Agreement</a>
                {' '}(required under GDPR/EU AI Act)
              </label>
            </div>
          </div>
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={loading || !data.tosAccepted || !data.dpaAccepted}
        size="lg"
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </Button>
    </form>
  );
}
