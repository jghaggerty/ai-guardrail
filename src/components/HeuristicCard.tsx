import { HeuristicFinding } from '@/types/bias';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Brain, DollarSign, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeuristicCardProps {
  finding: HeuristicFinding;
  onViewDetails: (finding: HeuristicFinding) => void;
}

const getHeuristicIcon = (type: string) => {
  switch (type) {
    case 'anchoring': return Target;
    case 'loss_aversion': return DollarSign;
    case 'confirmation': return Brain;
    case 'sunk_cost': return TrendingUp;
    default: return AlertTriangle;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-severity-critical text-white';
    case 'high': return 'bg-severity-high text-white';
    case 'medium': return 'bg-severity-medium text-white';
    case 'low': return 'bg-severity-low text-white';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const HeuristicCard = ({ finding, onViewDetails }: HeuristicCardProps) => {
  const Icon = getHeuristicIcon(finding.type);
  
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">{finding.name}</h3>
            <p className="text-sm text-muted-foreground">
              Confidence: {finding.confidence}%
            </p>
          </div>
        </div>
        <Badge className={cn('uppercase text-xs font-semibold', getSeverityColor(finding.severity))}>
          {finding.severity}
        </Badge>
      </div>
      
      <p className="text-sm text-card-foreground mb-4 line-clamp-2">
        {finding.description}
      </p>
      
      <div className="bg-metric-bg p-3 rounded-md mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">Impact Assessment</p>
        <p className="text-sm text-card-foreground line-clamp-2">{finding.impact}</p>
      </div>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={() => onViewDetails(finding)}
      >
        View Detailed Analysis
      </Button>
    </Card>
  );
};
