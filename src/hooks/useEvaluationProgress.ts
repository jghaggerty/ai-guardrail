import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EvaluationProgress {
  id: string;
  evaluation_id: string;
  progress_percent: number;
  current_phase: string;
  current_heuristic: string | null;
  tests_completed: number;
  tests_total: number;
  message: string | null;
  updated_at: string;
}

interface UseEvaluationProgressOptions {
  evaluationId?: string;
  onComplete?: () => void;
}

export function useEvaluationProgress(options: UseEvaluationProgressOptions = {}) {
  const { evaluationId, onComplete } = options;
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Subscribe to all evaluation progress updates (for when we don't know the ID yet)
  const subscribeToAllProgress = useCallback(() => {
    const channel = supabase
      .channel('evaluation-progress-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evaluation_progress',
        },
        (payload) => {
          console.log('Progress update received:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newProgress = payload.new as EvaluationProgress;
            setProgress(newProgress);
            
            if (newProgress.progress_percent >= 100 && onComplete) {
              onComplete();
            }
          } else if (payload.eventType === 'DELETE') {
            setProgress(null);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('Unsubscribing from progress channel');
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [onComplete]);

  // Subscribe to a specific evaluation's progress
  const subscribeToEvaluation = useCallback((evalId: string) => {
    const channel = supabase
      .channel(`evaluation-progress-${evalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evaluation_progress',
          filter: `evaluation_id=eq.${evalId}`,
        },
        (payload) => {
          console.log('Progress update for evaluation:', evalId, payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newProgress = payload.new as EvaluationProgress;
            setProgress(newProgress);
            
            if (newProgress.progress_percent >= 100 && onComplete) {
              onComplete();
            }
          } else if (payload.eventType === 'DELETE') {
            setProgress(null);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status for', evalId, ':', status);
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [onComplete]);

  useEffect(() => {
    if (evaluationId) {
      return subscribeToEvaluation(evaluationId);
    } else {
      return subscribeToAllProgress();
    }
  }, [evaluationId, subscribeToEvaluation, subscribeToAllProgress]);

  // Reset progress state
  const resetProgress = useCallback(() => {
    setProgress(null);
  }, []);

  // Get formatted progress message
  const getProgressMessage = useCallback(() => {
    if (!progress) return 'Initializing...';
    
    if (progress.current_heuristic) {
      return `${progress.message} (${progress.tests_completed + 1}/${progress.tests_total})`;
    }
    
    return progress.message || 'Processing...';
  }, [progress]);

  // Get phase display name
  const getPhaseLabel = useCallback(() => {
    if (!progress) return 'Starting';
    
    const phaseLabels: Record<string, string> = {
      initializing: 'Initializing',
      detecting: 'Analyzing Biases',
      processing: 'Processing Results',
      finalizing: 'Generating Report',
      completed: 'Complete',
    };
    
    return phaseLabels[progress.current_phase] || progress.current_phase;
  }, [progress]);

  return {
    progress,
    isSubscribed,
    progressPercent: progress?.progress_percent ?? 0,
    currentPhase: progress?.current_phase ?? 'initializing',
    currentHeuristic: progress?.current_heuristic,
    testsCompleted: progress?.tests_completed ?? 0,
    testsTotal: progress?.tests_total ?? 0,
    message: getProgressMessage(),
    phaseLabel: getPhaseLabel(),
    resetProgress,
  };
}
