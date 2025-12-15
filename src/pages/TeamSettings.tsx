import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TeamManagement } from '@/components/TeamManagement';
import { TeamSwitcher } from '@/components/TeamSwitcher';

const TeamSettings = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
          <TeamSwitcher />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Team Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your teams, members, and organization settings
          </p>
        </div>

        <TeamManagement />
      </main>
    </div>
  );
};

export default TeamSettings;
