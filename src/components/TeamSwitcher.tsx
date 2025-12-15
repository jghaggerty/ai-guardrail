import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { getUserTeams, switchActiveTeam, getActiveTeamId, Team } from '@/lib/teamApi';
import { toast } from 'sonner';

interface TeamSwitcherProps {
  onTeamChange?: (teamId: string) => void;
  className?: string;
}

export function TeamSwitcher({ onTeamChange, className }: TeamSwitcherProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const [userTeams, currentActiveId] = await Promise.all([
          getUserTeams(user.id),
          getActiveTeamId(user.id),
        ]);

        setTeams(userTeams);
        setActiveTeamId(currentActiveId);
      } catch (error) {
        console.error('Error loading teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [user]);

  const activeTeam = teams.find(t => t.id === activeTeamId);

  const handleTeamSelect = async (teamId: string) => {
    if (!user || teamId === activeTeamId) {
      setOpen(false);
      return;
    }

    const success = await switchActiveTeam(user.id, teamId);
    if (success) {
      setActiveTeamId(teamId);
      const newTeam = teams.find(t => t.id === teamId);
      toast.success(`Switched to ${newTeam?.name || 'team'}`);
      onTeamChange?.(teamId);
      // Reload the page to refresh data for new team context
      window.location.reload();
    } else {
      toast.error('Failed to switch team');
    }

    setOpen(false);
  };

  if (loading) {
    return (
      <Button variant="outline" className={cn('w-[200px] justify-between', className)} disabled>
        <span className="text-muted-foreground">Loading...</span>
      </Button>
    );
  }

  if (teams.length <= 1) {
    // Don't show switcher if user only has one team
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-[200px] justify-between', className)}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{activeTeam?.name || 'Select team'}</span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search teams..." />
          <CommandList>
            <CommandEmpty>No teams found.</CommandEmpty>
            <CommandGroup heading="Your Teams">
              {teams.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.name}
                  onSelect={() => handleTeamSelect(team.id)}
                  className="cursor-pointer"
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate flex-1">{team.name}</span>
                  <span className="text-xs text-muted-foreground mr-2">
                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <Check
                    className={cn(
                      'h-4 w-4',
                      activeTeamId === team.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
