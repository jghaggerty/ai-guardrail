import { HeuristicFinding, EvidenceStorageType } from '@/types/bias';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Brain, DollarSign, Target, Copy, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface HeuristicCardProps {
  finding: HeuristicFinding;
  onViewDetails: (finding: HeuristicFinding) => void;
  evidenceReferenceId?: string;
  evidenceStorageType?: EvidenceStorageType;
}

const getHeuristicIcon = (type: string) => {
  switch (type) {
    case 'anchoring': return Target;
    case 'loss_aversion': return DollarSign;
    case 'confirmation_bias': return Brain;
    case 'sunk_cost': return TrendingUp;
    case 'availability_heuristic': return AlertTriangle;
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

const getStorageTypeLabel = (type?: EvidenceStorageType): string => {
  if (!type) return '';
  switch (type) {
    case 's3':
      return 'S3';
    case 'splunk':
      return 'Splunk';
    case 'elk':
      return 'ELK';
  }
};

export const HeuristicCard = ({ 
  finding, 
  onViewDetails, 
  evidenceReferenceId,
  evidenceStorageType 
}: HeuristicCardProps) => {
  const Icon = getHeuristicIcon(finding.type);
  const [copiedReferenceId, setCopiedReferenceId] = useState(false);

  const handleCopyReferenceId = async (referenceId: string) => {
    try {
      await navigator.clipboard.writeText(referenceId);
      setCopiedReferenceId(true);
      toast.success('Reference ID copied to clipboard');
      setTimeout(() => setCopiedReferenceId(false), 2000);
    } catch (error) {
      toast.error('Failed to copy reference ID');
    }
  };
  
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-card-foreground">{finding.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                Confidence: {finding.confidence}%
              </p>
              {evidenceReferenceId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyReferenceId(evidenceReferenceId);
                        }}
                      >
                        <Badge 
                          variant="outline" 
                          className="text-xs px-1.5 py-0.5 cursor-pointer hover:bg-muted/50"
                          title="Click to copy reference ID"
                        >
                          {evidenceStorageType ? getStorageTypeLabel(evidenceStorageType) : 'REF'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyReferenceId(evidenceReferenceId);
                          }}
                        >
                          {copiedReferenceId ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2">
                        <p className="font-semibold">Evidence Reference ID</p>
                        <code className="text-xs block break-all bg-background p-1 rounded">{evidenceReferenceId}</code>
                        <div className="space-y-1 mt-2">
                          <p className="text-xs font-semibold">What is this?</p>
                          <p className="text-xs text-muted-foreground">
                            A unique identifier linking this heuristic finding to the original prompts and outputs stored in your {getStorageTypeLabel(evidenceStorageType)} storage system.
                          </p>
                          <p className="text-xs font-semibold mt-2">How to use:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            <li>Click badge or copy icon to copy the ID</li>
                            <li>Search for this ID in your {getStorageTypeLabel(evidenceStorageType)} storage</li>
                            <li>Access the exact prompts/outputs that generated this finding</li>
                          </ul>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
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
