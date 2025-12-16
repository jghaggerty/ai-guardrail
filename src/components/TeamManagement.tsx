import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Users, 
  Plus, 
  Mail, 
  Shield, 
  Eye, 
  UserCog, 
  Crown,
  Trash2,
  Clock,
  Building2,
  Loader2,
  Pencil,
} from 'lucide-react';
import {
  Team,
  TeamMember,
  TeamInvitation,
  CompanyMember,
  getUserTeams,
  getTeamMembers,
  getTeamInvitations,
  createTeamInvitation,
  deleteTeamInvitation,
  createTeam,
  getUserCompany,
  isCompanyAdmin,
  updateMemberRole,
  removeTeamMember,
  getActiveTeamId,
  getCompanyMembers,
  fetchUserEmails,
  updateUserProfile,
  Company,
} from '@/lib/teamApi';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full control over team', icon: Crown, color: 'text-amber-500' },
  { value: 'admin', label: 'Admin', description: 'Manage team settings and members', icon: Shield, color: 'text-blue-500' },
  { value: 'evaluator', label: 'Evaluator', description: 'Run evaluations and view reports', icon: UserCog, color: 'text-green-500' },
  { value: 'viewer', label: 'Viewer', description: 'View reports only', icon: Eye, color: 'text-muted-foreground' },
];

export function TeamManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dialog states
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CompanyMember | null>(null);
  const [editName, setEditName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'evaluator' | 'viewer'>('evaluator');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [userTeams, currentActiveId, companyData] = await Promise.all([
        getUserTeams(user.id),
        getActiveTeamId(user.id),
        getUserCompany(user.id),
      ]);

      setTeams(userTeams);
      setActiveTeamId(currentActiveId);
      
      if (companyData) {
        setCompany(companyData);
        setCompanyId(companyData.id);
        const [adminStatus, allCompanyMembers] = await Promise.all([
          isCompanyAdmin(user.id, companyData.id),
          getCompanyMembers(companyData.id),
        ]);
        setIsAdmin(adminStatus);
        setCompanyMembers(allCompanyMembers);
        
        // Fetch emails if user is admin
        if (adminStatus && allCompanyMembers.length > 0) {
          const userIds = allCompanyMembers.map(m => m.user_id);
          const emails = await fetchUserEmails(userIds);
          setMemberEmails(emails);
        }
      }

      // Load members and invitations for active team
      if (currentActiveId) {
        const [teamMembers, teamInvitations] = await Promise.all([
          getTeamMembers(currentActiveId),
          getTeamInvitations(currentActiveId),
        ]);
        setMembers(teamMembers);
        setInvitations(teamInvitations);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!user || !companyId || !newTeamName.trim()) return;

    setSubmitting(true);
    try {
      const result = await createTeam(newTeamName.trim(), companyId, user.id);
      if (result.success && result.team) {
        setTeams([...teams, result.team]);
        toast.success(`Team "${newTeamName}" created`);
        setCreateTeamDialogOpen(false);
        setNewTeamName('');
      } else {
        toast.error(result.error || 'Failed to create team');
      }
    } catch (error) {
      toast.error('Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteMember = async () => {
    if (!user || !activeTeamId) return;

    const validation = emailSchema.safeParse(newInviteEmail);
    if (!validation.success) {
      setEmailError(validation.error.errors[0].message);
      return;
    }

    // Check for duplicate
    if (invitations.some(inv => inv.email.toLowerCase() === newInviteEmail.toLowerCase())) {
      setEmailError('This email already has a pending invitation');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createTeamInvitation(activeTeamId, newInviteEmail, newInviteRole, user.id);
      if (result.success) {
        await loadData(); // Refresh invitations
        toast.success(`Invitation sent to ${newInviteEmail}`);
        setInviteDialogOpen(false);
        setNewInviteEmail('');
        setNewInviteRole('evaluator');
        setEmailError('');
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    const success = await deleteTeamInvitation(invitationId);
    if (success) {
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      toast.success('Invitation revoked');
    } else {
      toast.error('Failed to revoke invitation');
    }
  };

  const handleUpdateRole = async (roleId: string, newRole: 'admin' | 'evaluator' | 'viewer') => {
    const success = await updateMemberRole(roleId, newRole);
    if (success) {
      setMembers(members.map(m => m.id === roleId ? { ...m, role: newRole } : m));
      toast.success('Role updated');
    } else {
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (roleId: string, memberName: string) => {
    const success = await removeTeamMember(roleId);
    if (success) {
      setMembers(members.filter(m => m.id !== roleId));
      toast.success(`${memberName} removed from team`);
    } else {
      toast.error('Failed to remove member');
    }
  };

  const handleEditMember = (member: CompanyMember) => {
    setEditingMember(member);
    setEditName(member.full_name || '');
    setEditMemberDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editingMember) return;
    
    setSubmitting(true);
    try {
      const result = await updateUserProfile(editingMember.user_id, editName);
      if (result.success) {
        setCompanyMembers(companyMembers.map(m => 
          m.user_id === editingMember.user_id ? { ...m, full_name: editName } : m
        ));
        toast.success('Profile updated');
        setEditMemberDialogOpen(false);
        setEditingMember(null);
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleConfig = (role: string) => {
    return ROLES.find(r => r.value === role) || ROLES[3];
  };

  const activeTeam = teams.find(t => t.id === activeTeamId);
  const currentUserRole = members.find(m => m.user_id === user?.id)?.role;
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Teams Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Your Teams
            </CardTitle>
            <CardDescription>
              Teams you're a member of across your organization
            </CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={createTeamDialogOpen} onOpenChange={setCreateTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Team</DialogTitle>
                  <DialogDescription>
                    Create a new team within your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team Name</Label>
                    <Input
                      id="teamName"
                      placeholder="e.g., Engineering, Product, Research"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCreateTeam}
                    disabled={!newTeamName.trim() || submitting}
                    className="w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Team'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No teams found</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    team.id === activeTeamId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">{team.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    {team.id === activeTeamId && (
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Team Management */}
      {activeTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {activeTeam.name} — Team Management
            </CardTitle>
            <CardDescription>
              Manage members and invitations for your current team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
                <TabsTrigger value="invitations">
                  Pending Invitations ({invitations.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="mt-4">
                <div className="flex justify-end mb-4">
                  {canManageMembers && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Invite Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite Team Member</DialogTitle>
                          <DialogDescription>
                            Send an invitation to join {activeTeam.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="colleague@company.com"
                              value={newInviteEmail}
                              onChange={(e) => {
                                setNewInviteEmail(e.target.value);
                                setEmailError('');
                              }}
                              className={emailError ? 'border-destructive' : ''}
                            />
                            {emailError && (
                              <p className="text-xs text-destructive">{emailError}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                              value={newInviteRole}
                              onValueChange={(v) => setNewInviteRole(v as typeof newInviteRole)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.filter(r => r.value !== 'owner').map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    <div className="flex items-center gap-2">
                                      <role.icon className={`h-4 w-4 ${role.color}`} />
                                      <span>{role.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {getRoleConfig(newInviteRole).description}
                            </p>
                          </div>
                          <Button
                            onClick={handleInviteMember}
                            disabled={!newInviteEmail || submitting}
                            className="w-full"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              'Send Invitation'
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {canManageMembers && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const roleConfig = getRoleConfig(member.role);
                      const isCurrentUser = member.user_id === user?.id;
                      const canEdit = canManageMembers && !isCurrentUser && member.role !== 'owner';

                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {member.profile?.full_name || 'Unknown'}
                                  {isCurrentUser && (
                                    <span className="text-muted-foreground ml-2">(you)</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {canEdit ? (
                              <Select
                                value={member.role}
                                onValueChange={(v) => handleUpdateRole(member.id, v as 'admin' | 'evaluator' | 'viewer')}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.filter(r => r.value !== 'owner').map((role) => (
                                    <SelectItem key={role.value} value={role.value}>
                                      <div className="flex items-center gap-2">
                                        <role.icon className={`h-4 w-4 ${role.color}`} />
                                        <span>{role.label}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-2">
                                <roleConfig.icon className={`h-4 w-4 ${roleConfig.color}`} />
                                <span>{roleConfig.label}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString()}
                          </TableCell>
                          {canManageMembers && (
                            <TableCell>
                              {canEdit && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove{' '}
                                        {member.profile?.full_name || 'this member'} from the team?
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleRemoveMember(member.id, member.profile?.full_name || 'Member')}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="invitations" className="mt-4">
                {invitations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No pending invitations</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Expires</TableHead>
                        {canManageMembers && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invitation) => {
                        const roleConfig = getRoleConfig(invitation.role);
                        const expiresAt = new Date(invitation.expires_at);
                        const isExpired = expiresAt < new Date();

                        return (
                          <TableRow key={invitation.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-foreground">{invitation.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <roleConfig.icon className={`h-4 w-4 ${roleConfig.color}`} />
                                <span>{roleConfig.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className={isExpired ? 'text-destructive' : ''}>
                                  {isExpired ? 'Expired' : expiresAt.toLocaleDateString()}
                                </span>
                              </div>
                            </TableCell>
                            {canManageMembers && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteInvitation(invitation.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Company-Wide Members */}
      {company && companyMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {company.name} — All Organization Members
            </CardTitle>
            <CardDescription>
              All users across all teams in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  {isAdmin && <TableHead>Email</TableHead>}
                  <TableHead>Team</TableHead>
                  <TableHead>Team Role</TableHead>
                  <TableHead>Company Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyMembers.map((member) => {
                  const roleConfig = getRoleConfig(member.team_role);
                  const isCurrentUser = member.user_id === user?.id;

                  return (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {member.full_name || 'Unknown'}
                              {isCurrentUser && (
                                <span className="text-muted-foreground ml-2">(you)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-muted-foreground">
                          {memberEmails[member.user_id] || '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {member.team_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <roleConfig.icon className={`h-4 w-4 ${roleConfig.color}`} />
                          <span>{roleConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.company_role === 'company_admin' ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Company Admin
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Member</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMember(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Member Dialog */}
      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update member details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {editingMember && isAdmin && memberEmails[editingMember.user_id] && (
              <div className="space-y-2">
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">
                  {memberEmails[editingMember.user_id]}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="editName">Full Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            {editingMember && (
              <div className="space-y-2">
                <Label>Current Role</Label>
                <div className="flex items-center gap-2">
                  {(() => {
                    const rc = getRoleConfig(editingMember.team_role);
                    return (
                      <>
                        <rc.icon className={`h-4 w-4 ${rc.color}`} />
                        <span>{rc.label}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            <Button
              onClick={handleSaveProfile}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
