import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingContext';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { SignUpStep } from '@/components/onboarding/SignUpStep';
import { VerifyEmailStep } from '@/components/onboarding/VerifyEmailStep';
import { OrganizationStep } from '@/components/onboarding/OrganizationStep';
import { TeamSetupStep } from '@/components/onboarding/TeamSetupStep';
import { LLMSelectionStep } from '@/components/onboarding/LLMSelectionStep';
import { APIKeysStep } from '@/components/onboarding/APIKeysStep';
import { TestSuiteStep } from '@/components/onboarding/TestSuiteStep';
import { AutomationStep } from '@/components/onboarding/AutomationStep';
import { SummaryStep } from '@/components/onboarding/SummaryStep';
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
      {step === 'team-setup' && <TeamSetupStep />}
      {step === 'llm-selection' && <LLMSelectionStep />}
      {step === 'api-keys' && <APIKeysStep />}
      {step === 'test-suite' && <TestSuiteStep />}
      {step === 'automation' && <AutomationStep />}
      {step === 'summary' && <SummaryStep />}
    </div>
  );
}

function AuthContent() {
  const { user, loading } = useAuth();
  const { step, setStep } = useOnboarding();
  const navigate = useNavigate();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (loading) return;
      
      if (!user) {
        setCheckingOnboarding(false);
        return;
      }

      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (profile?.onboarding_completed) {
        setOnboardingComplete(true);
        navigate('/', { replace: true });
      } else {
        // User is authenticated but hasn't completed onboarding
        // Move to verify-email step if still on signup
        if (step === 'signup') {
          setStep('verify-email');
        }
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user, loading, navigate, step, setStep]);

  // Redirect when onboarding completes
  useEffect(() => {
    if (step === 'complete') {
      navigate('/', { replace: true });
    }
  }, [step, navigate]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If user is authenticated, only show onboarding flow (not sign-in tab)
  const showOnboardingOnly = user && !onboardingComplete;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <Activity className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold text-foreground">AI Bias Diagnostic Tool</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Evaluate generative AI systems for behavioral and decision-making biases
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            {showOnboardingOnly ? (
              // Show only onboarding flow for authenticated users
              <OnboardingFlow />
            ) : (
              // Show tabs for non-authenticated users
              <Tabs defaultValue="signup" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signup">Create Account</TabsTrigger>
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signup" className="mt-0">
                  <OnboardingFlow />
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
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-4 text-xs text-muted-foreground">
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
  return (
    <OnboardingProvider>
      <AuthContent />
    </OnboardingProvider>
  );
}
