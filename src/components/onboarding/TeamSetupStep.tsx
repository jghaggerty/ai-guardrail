import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding, TeamInvite } from './OnboardingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, X, ArrowLeft, Mail, Shield, Eye, UserCog, CreditCard } from 'lucide-react';
import { z } from 'zod';

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features and settings', icon: Shield },
  { value: 'evaluator', label: 'Evaluator', description: 'Can run tests and view reports', icon: UserCog },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to reports', icon: Eye },
] as const;

const emailSchema = z.string().email('Please enter a valid email address');

export function TeamSetupStep() {
  const { data, updateData, setStep } = useOnboarding();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'evaluator' | 'viewer'>('evaluator');
  const [emailError, setEmailError] = useState('');

  const handleAddInvite = () => {
    const result = emailSchema.safeParse(newInviteEmail);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }

    // Check for duplicate
    if (data.teamInvites.some(inv => inv.email.toLowerCase() === newInviteEmail.toLowerCase())) {
      setEmailError('This email has already been invited');
      return;
    }

    // Check if it's the user's own email
    if (newInviteEmail.toLowerCase() === data.email.toLowerCase()) {
      setEmailError("You can't invite yourself");
      return;
    }

    const newInvites: TeamInvite[] = [...data.teamInvites, { email: newInviteEmail, role: newInviteRole }];
    updateData({ teamInvites: newInvites });
    
    setNewInviteEmail('');
    setNewInviteRole('evaluator');
    setEmailError('');
    setInviteDialogOpen(false);
    
    toast({ title: 'Invite Added', description: `${newInviteEmail} will be invited as ${newInviteRole}` });
  };

  const handleRemoveInvite = (email: string) => {
    const newInvites = data.teamInvites.filter(inv => inv.email !== email);
    updateData({ teamInvites: newInvites });
  };

  const handleBack = () => {
    setStep('organization');
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      // Get user's team_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;
      const teamId = profile.team_id;

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
          billing_email: data.useSameEmailForBilling ? data.email : data.billingEmail,
          billing_contact_name: data.useSameEmailForBilling ? data.fullName : data.billingContactName,
        })
        .eq('id', teamId);

      if (teamError) throw teamError;

      // Update profile
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          job_title: data.jobTitle,
          tos_accepted_at: new Date().toISOString(),
          onboarding_completed: true,
        })
        .eq('id', user!.id);

      if (profileUpdateError) throw profileUpdateError;

      // Create team invitations
      if (data.teamInvites.length > 0) {
        const invitations = data.teamInvites.map(invite => ({
          team_id: teamId,
          email: invite.email,
          role: invite.role,
          invited_by: user!.id,
        }));

        const { error: inviteError } = await supabase
          .from('team_invitations')
          .insert(invitations);

        if (inviteError) {
          console.error('Failed to create invitations:', inviteError);
          // Don't block completion for invite failures
          toast({ 
            title: 'Note', 
            description: 'Setup complete, but some invitations could not be sent. You can invite team members later.',
            variant: 'default' 
          });
        }
      }

      toast({ title: 'Team & Billing Saved', description: 'Now let\'s configure your LLMs.' });
      setStep('llm-selection');
    } catch (error: any) {
      console.error('Setup error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    const roleConfig = ROLES.find(r => r.value === role);
    return roleConfig ? roleConfig.icon : UserCog;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Set Up Team Access & Billing</h1>
        <p className="text-muted-foreground mt-1">
          Invite team members and configure billing contact (optional)
        </p>
      </div>

      {/* Team Invitations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Team Members</h3>
            <p className="text-sm text-muted-foreground">Add team members now or later from settings</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email Address</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="colleague@company.com"
                    value={newInviteEmail}
                    onChange={(e) => {
                      setNewInviteEmail(e.target.value);
                      setEmailError('');
                    }}
                    className={emailError ? 'border-destructive' : ''}
                  />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="inviteRole">Role</Label>
                  <Select value={newInviteRole} onValueChange={(value) => setNewInviteRole(value as typeof newInviteRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex items-center gap-2">
                            <role.icon className="h-4 w-4 text-muted-foreground" />
                            <span>{role.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {ROLES.find(r => r.value === newInviteRole)?.description}
                  </p>
                </div>

                <Button onClick={handleAddInvite} className="w-full">
                  Add Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Invited Members List */}
        {data.teamInvites.length > 0 ? (
          <div className="border border-border rounded-lg divide-y divide-border">
            {data.teamInvites.map((invite) => {
              const RoleIcon = getRoleIcon(invite.role);
              return (
                <div key={invite.email} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{invite.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveInvite(invite.email)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-lg p-6 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No team members invited yet. You can invite colleagues now or later from settings.
            </p>
          </div>
        )}
      </div>

      {/* Billing Contact Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium text-foreground">Billing Contact</h3>
          <span className="text-xs text-muted-foreground">(Enterprise accounts)</span>
        </div>

        <div className="flex items-start space-x-3">
          <Checkbox
            id="sameBilling"
            checked={data.useSameEmailForBilling}
            onCheckedChange={(checked) => updateData({ useSameEmailForBilling: checked as boolean })}
          />
          <label htmlFor="sameBilling" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
            Use my email ({data.email}) for billing and invoices
          </label>
        </div>

        {!data.useSameEmailForBilling && (
          <div className="grid gap-4 sm:grid-cols-2 pl-6">
            <div className="space-y-2">
              <Label htmlFor="billingName">Billing Contact Name</Label>
              <Input
                id="billingName"
                placeholder="Finance Department"
                value={data.billingContactName}
                onChange={(e) => updateData({ billingContactName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing Email</Label>
              <Input
                id="billingEmail"
                type="email"
                placeholder="billing@company.com"
                value={data.billingEmail}
                onChange={(e) => updateData({ billingEmail: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button 
          type="button" 
          onClick={handleComplete}
          className="flex-1"
          size="lg"
          disabled={loading}
        >
          {loading ? 'Completing Setup...' : 'Complete Setup — Start Evaluating'}
        </Button>
      </div>
    </div>
  );
}
