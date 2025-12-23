import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isTabActive, setIsTabActive] = useState(!document.hidden);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  
  // Use ref for onComplete to avoid re-subscribing when callback changes
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
            setLastUpdateTime(new Date());
            
            // Set start time on first progress update
            if (!startTime && newProgress.progress_percent > 0) {
              setStartTime(new Date());
            }
            
            if (newProgress.progress_percent >= 100 && onCompleteRef.current) {
              onCompleteRef.current();
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
  }, [startTime]);

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
            setLastUpdateTime(new Date());
            
            // Set start time on first progress update
            if (!startTime && newProgress.progress_percent > 0) {
              setStartTime(new Date());
            }
            
            if (newProgress.progress_percent >= 100 && onCompleteRef.current) {
              onCompleteRef.current();
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
  }, [startTime]);

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
    setStartTime(null);
    setLastUpdateTime(null);
  }, []);

  // Calculate ETA based on elapsed time and progress
  const getEta = useCallback((): string | null => {
    if (!progress || !startTime || progress.progress_percent <= 0) {
      return null;
    }

    const elapsed = Date.now() - startTime.getTime();
    const percentComplete = progress.progress_percent;
    
    if (percentComplete >= 100) {
      return 'Complete';
    }

    // Estimate total time based on current progress
    const estimatedTotal = (elapsed / percentComplete) * 100;
    const remainingMs = estimatedTotal - elapsed;

    if (remainingMs <= 0) {
      return 'Almost done...';
    }

    const remainingSeconds = Math.ceil(remainingMs / 1000);
    
    if (remainingSeconds < 60) {
      return `~${remainingSeconds}s remaining`;
    }
    
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return `~${remainingMinutes}m remaining`;
  }, [progress, startTime]);

  // Get formatted last update time
  const getLastUpdateDisplay = useCallback((): string | null => {
    if (!lastUpdateTime) {
      return null;
    }

    const now = new Date();
    const diffMs = now.getTime() - lastUpdateTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 5) {
      return 'Just now';
    }
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    return `${diffMinutes}m ago`;
  }, [lastUpdateTime]);

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
    isTabActive,
    progressPercent: progress?.progress_percent ?? 0,
    currentPhase: progress?.current_phase ?? 'initializing',
    currentHeuristic: progress?.current_heuristic,
    testsCompleted: progress?.tests_completed ?? 0,
    testsTotal: progress?.tests_total ?? 0,
    message: getProgressMessage(),
    phaseLabel: getPhaseLabel(),
    eta: getEta(),
    lastUpdate: getLastUpdateDisplay(),
    lastUpdateTime,
    resetProgress,
  };
}
