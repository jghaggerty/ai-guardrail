import { HeuristicFinding } from '@/types/bias';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FindingDetailsDialogProps {
  finding: HeuristicFinding | null;
  open: boolean;
  onClose: () => void;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-severity-critical text-white';
    case 'high': return 'bg-severity-high text-white';
    case 'medium': return 'bg-severity-medium text-white';
    case 'low': return 'bg-severity-low text-white';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const FindingDetailsDialog = ({ finding, open, onClose }: FindingDetailsDialogProps) => {
  if (!finding) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{finding.name}</DialogTitle>
            <Badge className={cn('uppercase text-xs font-semibold', getSeverityColor(finding.severity))}>
              {finding.severity}
            </Badge>
          </div>
          <DialogDescription>
            Detailed heuristic analysis and behavioral patterns
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-card-foreground mb-2">Confidence Level</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${finding.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-card-foreground">{finding.confidence}%</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-card-foreground mb-2">Description</h4>
              <p className="text-sm text-card-foreground leading-relaxed">
                {finding.description}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-card-foreground mb-3">Observed Examples</h4>
              <div className="space-y-3">
                {finding.examples.map((example, index) => (
                  <div key={index} className="p-4 bg-metric-bg rounded-lg border border-diagnostic-border">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">
                        Example {index + 1}
                      </Badge>
                      <p className="text-sm text-card-foreground">{example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-card-foreground mb-2">Impact Assessment</h4>
              <div className="p-4 bg-diagnostic-bg rounded-lg border border-diagnostic-border">
                <p className="text-sm text-card-foreground leading-relaxed">
                  {finding.impact}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Detected: {finding.detectedAt.toLocaleString()}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
