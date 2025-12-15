import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
import { EvaluationRun } from '@/types/bias';
import { fetchHistoricalEvaluations, loadEvaluationDetails, HistoricalEvaluation } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { History, Clock, ArrowRight, AlertCircle, Trash2, Database } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EvidenceStorageType } from '@/types/bias';

interface HistoryPanelProps {
  onLoadEvaluation: (evaluation: EvaluationRun) => void;
  filterSystem?: string;
}

export const HistoryPanel = ({ onLoadEvaluation, filterSystem }: HistoryPanelProps) => {
  const [evaluations, setEvaluations] = useState<HistoricalEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<string>(filterSystem || 'all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (filterSystem) {
      setSelectedSystem(filterSystem);
    }
  }, [filterSystem]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHistoricalEvaluations();
      setEvaluations(data);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('Failed to load evaluation history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadEvaluation = async (id: string) => {
    setLoadingId(id);
    try {
      const evaluation = await loadEvaluationDetails(id);
      onLoadEvaluation(evaluation);
      toast.success('Evaluation loaded successfully');
    } catch (error) {
      console.error('Failed to load evaluation:', error);
      toast.error('Failed to load evaluation details');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteEvaluation = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('evaluations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEvaluations(prev => prev.filter(e => e.id !== id));
      toast.success('Analysis deleted');
    } catch (error) {
      console.error('Failed to delete evaluation:', error);
      toast.error('Failed to delete analysis');
    } finally {
      setDeletingId(null);
    }
  };

  const uniqueSystems = [...new Set(evaluations.map(e => e.aiSystemName))];
  
  const filteredEvaluations = selectedSystem === 'all'
    ? evaluations
    : evaluations.filter(e => e.aiSystemName === selectedSystem);

  const getZoneBadge = (zone: string | null) => {
    if (!zone) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      green: 'default',
      yellow: 'secondary',
      red: 'destructive',
    };
    return (
      <Badge variant={variants[zone] || 'secondary'} className="capitalize">
        {zone}
      </Badge>
    );
  };

  const getStorageTypeLabel = (type?: EvidenceStorageType | null) => {
    switch (type) {
      case 's3':
        return 'S3';
      case 'splunk':
        return 'Splunk';
      case 'elk':
        return 'ELK';
      default:
        return type?.toUpperCase() || '';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Historical Analyses</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Historical Analyses</h3>
        </div>
        {!filterSystem && uniqueSystems.length > 1 && (
          <Select value={selectedSystem} onValueChange={setSelectedSystem}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Systems</SelectItem>
              {uniqueSystems.map(system => (
                <SelectItem key={system} value={system}>{system}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filteredEvaluations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No historical analyses found</p>
          {filterSystem && (
            <p className="text-xs mt-1">for {filterSystem}</p>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {filteredEvaluations.map(evaluation => (
              <div
                key={evaluation.id}
                className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-card-foreground truncate">
                        {evaluation.aiSystemName}
                      </span>
                      {getZoneBadge(evaluation.zoneStatus)}
                      {evaluation.evidenceReferenceId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className="text-xs px-1.5 py-0.5 flex items-center gap-1 cursor-help"
                              >
                                <Database className="w-3 h-3" />
                                {evaluation.evidenceStorageType ? getStorageTypeLabel(evaluation.evidenceStorageType) : 'REF'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">Evidence Reference Available</p>
                                <p className="text-sm">
                                  This evaluation has evidence stored in {evaluation.evidenceStorageType ? getStorageTypeLabel(evaluation.evidenceStorageType).toLowerCase() : 'your storage system'}. 
                                  View the evaluation to access the reference ID.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(evaluation.createdAt), 'MMM d, yyyy HH:mm')}
                      </span>
                      {evaluation.overallScore !== null && (
                        <span>Score: {evaluation.overallScore.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLoadEvaluation(evaluation.id)}
                      disabled={loadingId === evaluation.id || deletingId === evaluation.id}
                    >
                      {loadingId === evaluation.id ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        <>
                          View <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === evaluation.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this analysis for "{evaluation.aiSystemName}"? 
                            This will permanently remove all findings and recommendations associated with it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteEvaluation(evaluation.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};