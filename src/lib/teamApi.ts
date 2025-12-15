import { supabase } from '@/integrations/supabase/client';

export interface Team {
  id: string;
  name: string;
  company_id: string | null;
  created_at: string;
  memberCount?: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: 'owner' | 'admin' | 'evaluator' | 'viewer';
  created_at: string;
  profile?: {
    full_name: string | null;
    email?: string;
  };
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'evaluator' | 'viewer';
  team_id: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface Company {
  id: string;
  name: string;
  billing_email: string | null;
  billing_contact_name: string | null;
  company_size: string | null;
  industry: string[] | null;
  headquarters_country: string | null;
  headquarters_state: string | null;
}

/**
 * Get the current user's active team ID
 */
export async function getActiveTeamId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('active_team_id, team_id')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching active team:', error);
    return null;
  }

  return data?.active_team_id || data?.team_id || null;
}

/**
 * Get all teams the user belongs to
 */
export async function getUserTeams(userId: string): Promise<Team[]> {
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('team_id')
    .eq('user_id', userId);

  if (rolesError || !userRoles) {
    console.error('Error fetching user roles:', rolesError);
    return [];
  }

  const teamIds = userRoles.map(r => r.team_id);
  if (teamIds.length === 0) return [];

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .in('id', teamIds);

  if (teamsError || !teams) {
    console.error('Error fetching teams:', teamsError);
    return [];
  }

  // Get member counts for each team
  const teamsWithCounts = await Promise.all(
    teams.map(async (team) => {
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);

      return {
        ...team,
        memberCount: count || 0,
      };
    })
  );

  return teamsWithCounts;
}

/**
 * Switch the user's active team
 */
export async function switchActiveTeam(userId: string, teamId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ active_team_id: teamId })
    .eq('id', userId);

  if (error) {
    console.error('Error switching team:', error);
    return false;
  }

  return true;
}

/**
 * Get members of a team
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      id,
      user_id,
      team_id,
      role,
      created_at
    `)
    .eq('team_id', teamId);

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  // Fetch profiles for each member
  const membersWithProfiles = await Promise.all(
    (data || []).map(async (member) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', member.user_id)
        .single();

      return {
        ...member,
        profile: profile || { full_name: null },
      };
    })
  );

  return membersWithProfiles as TeamMember[];
}

/**
 * Get pending invitations for a team
 */
export async function getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  const { data, error } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('team_id', teamId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new team invitation
 */
export async function createTeamInvitation(
  teamId: string,
  email: string,
  role: 'admin' | 'evaluator' | 'viewer',
  invitedBy: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('team_invitations')
    .insert({
      team_id: teamId,
      email,
      role,
      invited_by: invitedBy,
    });

  if (error) {
    console.error('Error creating invitation:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a team invitation
 */
export async function deleteTeamInvitation(invitationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('team_invitations')
    .delete()
    .eq('id', invitationId);

  if (error) {
    console.error('Error deleting invitation:', error);
    return false;
  }

  return true;
}

/**
 * Create a new team (company admins only)
 */
export async function createTeam(
  name: string,
  companyId: string,
  creatorId: string
): Promise<{ success: boolean; team?: Team; error?: string }> {
  // Create the team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name,
      company_id: companyId,
    })
    .select()
    .single();

  if (teamError) {
    console.error('Error creating team:', teamError);
    return { success: false, error: teamError.message };
  }

  // Add creator as owner
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: creatorId,
      team_id: team.id,
      role: 'owner',
    });

  if (roleError) {
    console.error('Error assigning owner role:', roleError);
    // Rollback team creation
    await supabase.from('teams').delete().eq('id', team.id);
    return { success: false, error: roleError.message };
  }

  return { success: true, team };
}

/**
 * Get user's company info
 */
export async function getUserCompany(userId: string): Promise<Company | null> {
  // First get the user's team
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', userId)
    .single();

  if (!profile?.team_id) return null;

  // Get team's company_id
  const { data: team } = await supabase
    .from('teams')
    .select('company_id')
    .eq('id', profile.team_id)
    .single();

  if (!team?.company_id) return null;

  // Get company details
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', team.company_id)
    .single();

  if (error) {
    console.error('Error fetching company:', error);
    return null;
  }

  return company;
}

/**
 * Check if user is a company admin
 */
export async function isCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('company_user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('role', 'company_admin')
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * Update team member role
 */
export async function updateMemberRole(
  roleId: string,
  newRole: 'admin' | 'evaluator' | 'viewer'
): Promise<boolean> {
  const { error } = await supabase
    .from('user_roles')
    .update({ role: newRole })
    .eq('id', roleId);

  if (error) {
    console.error('Error updating role:', error);
    return false;
  }

  return true;
}

/**
 * Remove team member
 */
export async function removeTeamMember(roleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('id', roleId);

  if (error) {
    console.error('Error removing member:', error);
    return false;
  }

  return true;
}
