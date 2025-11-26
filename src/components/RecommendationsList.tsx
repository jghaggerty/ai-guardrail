import { Recommendation } from '@/types/bias';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecommendationsListProps {
  recommendations: Recommendation[];
  viewMode: 'technical' | 'simplified';
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-danger text-danger-foreground';
    case 'medium': return 'bg-warning text-warning-foreground';
    case 'low': return 'bg-success text-success-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getComplexityBadge = (complexity: string) => {
  switch (complexity) {
    case 'high': return 'border-danger text-danger';
    case 'medium': return 'border-warning text-warning';
    case 'low': return 'border-success text-success';
    default: return 'border-muted text-muted-foreground';
  }
};

export const RecommendationsList = ({ recommendations, viewMode }: RecommendationsListProps) => {
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-2">
          Actionable Recommendations
        </h3>
        <p className="text-sm text-muted-foreground">
          Prioritized mitigation strategies ranked by impact and urgency
        </p>
      </div>

      <div className="space-y-4">
        {sortedRecommendations.map((rec, index) => (
          <Card key={rec.id} className="p-5 border-l-4" style={{
            borderLeftColor: rec.priority === 'high' ? 'hsl(var(--danger))' : 
                           rec.priority === 'medium' ? 'hsl(var(--warning))' : 
                           'hsl(var(--success))'
          }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div className={cn(
                  'p-2 rounded-lg mt-1',
                  rec.priority === 'high' ? 'bg-danger/10' :
                  rec.priority === 'medium' ? 'bg-warning/10' :
                  'bg-success/10'
                )}>
                  {rec.priority === 'high' ? (
                    <AlertCircle className="w-5 h-5 text-danger" />
                  ) : (
                    <Zap className="w-5 h-5 text-warning" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={cn('uppercase text-xs font-semibold', getPriorityColor(rec.priority))}>
                      {rec.priority} Priority
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Related to: <span className="font-medium text-card-foreground capitalize">
                        {rec.relatedHeuristic.replace('_', ' ')}
                      </span>
                    </span>
                  </div>
                  <h4 className="font-semibold text-card-foreground mb-2">
                    {index + 1}. {rec.title}
                  </h4>
                  <p className="text-sm text-card-foreground mb-3">
                    {rec.description}
                  </p>
                  
                  {viewMode === 'technical' && (
                    <div className="bg-metric-bg p-3 rounded-md mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Implementation Action
                      </p>
                      <p className="text-sm text-card-foreground">{rec.action}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <ArrowRight className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Impact:</span>
                      <span className="font-medium text-card-foreground">{rec.estimatedImpact}</span>
                    </div>
                    <Badge variant="outline" className={cn('text-xs', getComplexityBadge(rec.implementationComplexity))}>
                      {rec.implementationComplexity} complexity
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {viewMode === 'simplified' && (
        <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-card-foreground">
            <span className="font-semibold">Next Steps:</span> Focus on high-priority recommendations first. 
            Switch to Technical View for detailed implementation guidance.
          </p>
        </div>
      )}
    </Card>
  );
};
