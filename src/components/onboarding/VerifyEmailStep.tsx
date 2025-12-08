import { useState, useEffect } from 'react';
import { useOnboarding } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, RefreshCw, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function VerifyEmailStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(data.email);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check if user is verified
  useEffect(() => {
    if (user?.email_confirmed_at) {
      setStep('organization');
    }
  }, [user, setStep]);

  const handleResendEmail = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: data.email,
    });
    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email Sent', description: 'Verification email has been resent.' });
      setResendCooldown(60);
    }
  };

  const handleContinue = () => {
    // For development/demo purposes, allow skipping verification
    setStep('organization');
  };

  const handleUpdateEmail = async () => {
    if (newEmail === data.email) {
      setIsEditingEmail(false);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      updateData({ email: newEmail });
      setIsEditingEmail(false);
      toast({ title: 'Email Updated', description: 'Please check your new email for verification.' });
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <Mail className="h-8 w-8 text-primary" />
      </div>
      
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Verify Your Email Address</h1>
        <p className="text-muted-foreground mt-2">
          We've sent a verification link to your email. Please click it to confirm your address.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
        {isEditingEmail ? (
          <div className="flex gap-2">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={handleUpdateEmail} disabled={loading}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditingEmail(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="font-medium text-foreground">{data.email}</span>
            <button
              onClick={() => setIsEditingEmail(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button 
          onClick={handleContinue} 
          className="w-full max-w-xs"
          size="lg"
        >
          I've Verified My Email — Continue Setup
        </Button>
        
        <div className="text-sm text-muted-foreground">
          Didn't receive the email?{' '}
          {resendCooldown > 0 ? (
            <span>Resend in {resendCooldown}s</span>
          ) : (
            <button
              onClick={handleResendEmail}
              disabled={loading}
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Resend Verification Email
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        The verification link expires in 24 hours. If you didn't request this account, 
        you can safely ignore this email.
      </p>
    </div>
  );
}
