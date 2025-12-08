import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingContext';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { SignUpStep } from '@/components/onboarding/SignUpStep';
import { VerifyEmailStep } from '@/components/onboarding/VerifyEmailStep';
import { OrganizationStep } from '@/components/onboarding/OrganizationStep';
import { SignInForm } from '@/components/onboarding/SignInForm';
import { Activity } from 'lucide-react';

function OnboardingFlow() {
  const { step } = useOnboarding();

  return (
    <div className="w-full">
      <StepIndicator currentStep={step} />
      
      {step === 'signup' && <SignUpStep />}
      {step === 'verify-email' && <VerifyEmailStep />}
      {step === 'organization' && <OrganizationStep />}
    </div>
  );
}

function AuthContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  if (!loading && user) {
    navigate('/', { replace: true });
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-2xl font-semibold text-foreground">AI Bias Diagnostic Tool</span>
          </div>
          <p className="text-muted-foreground">
            Evaluate generative AI systems for behavioral and decision-making biases
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <Tabs defaultValue="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signup">Create Account</TabsTrigger>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signup" className="mt-0">
                <OnboardingProvider>
                  <OnboardingFlow />
                </OnboardingProvider>
              </TabsContent>
              
              <TabsContent value="signin" className="mt-0">
                <div className="max-w-sm mx-auto">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-foreground">Welcome Back</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Sign in to continue your bias evaluations
                    </p>
                  </div>
                  <SignInForm />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-muted-foreground">
          <p>
            By using this service, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Auth() {
  return <AuthContent />;
}
