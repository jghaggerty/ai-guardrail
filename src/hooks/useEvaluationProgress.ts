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

export interface ProgressHistoryEntry {
  id: string;
  timestamp: Date;
  phase: string;
  heuristic: string | null;
  message: string | null;
  progressPercent: number;
}

interface UseEvaluationProgressOptions {
  evaluationId?: string;
  onComplete?: () => void;
  enableNotifications?: boolean;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

// Send browser notification
function sendNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: 'evaluation-complete',
    });
  }
}

export function useEvaluationProgress(options: UseEvaluationProgressOptions = {}) {
  const { evaluationId, onComplete, enableNotifications = true } = options;
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressHistoryEntry[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isTabActive, setIsTabActive] = useState(!document.hidden);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  
  // Track last recorded phase/heuristic to avoid duplicate history entries
  const lastRecordedRef = useRef<{ phase: string; heuristic: string | null }>({ phase: '', heuristic: null });
  
  // Use ref for onComplete to avoid re-subscribing when callback changes
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Add entry to progress history (only when phase or heuristic changes)
  const addHistoryEntry = useCallback((newProgress: EvaluationProgress) => {
    const lastRecorded = lastRecordedRef.current;
    
    // Only add if phase or heuristic has changed
    if (lastRecorded.phase !== newProgress.current_phase || 
        lastRecorded.heuristic !== newProgress.current_heuristic) {
      
      const entry: ProgressHistoryEntry = {
        id: `${newProgress.current_phase}-${newProgress.current_heuristic || 'none'}-${Date.now()}`,
        timestamp: new Date(),
        phase: newProgress.current_phase,
        heuristic: newProgress.current_heuristic,
        message: newProgress.message,
        progressPercent: newProgress.progress_percent,
      };
      
      setProgressHistory(prev => [...prev, entry]);
      lastRecordedRef.current = { 
        phase: newProgress.current_phase, 
        heuristic: newProgress.current_heuristic 
      };
    }
  }, []);

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
            addHistoryEntry(newProgress);
            
            // Set start time on first progress update
            if (!startTime && newProgress.progress_percent > 0) {
              setStartTime(new Date());
            }
            
            if (newProgress.progress_percent >= 100 && onCompleteRef.current) {
              // Send notification if tab is inactive
              if (enableNotifications && document.hidden) {
                sendNotification(
                  'Analysis Complete',
                  'Your AI bias diagnostic analysis has finished. Click to view results.'
                );
              }
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
            addHistoryEntry(newProgress);
            
            // Set start time on first progress update
            if (!startTime && newProgress.progress_percent > 0) {
              setStartTime(new Date());
            }
            
            if (newProgress.progress_percent >= 100 && onCompleteRef.current) {
              // Send notification if tab is inactive
              if (enableNotifications && document.hidden) {
                sendNotification(
                  'Analysis Complete',
                  'Your AI bias diagnostic analysis has finished. Click to view results.'
                );
              }
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
    setProgressHistory([]);
    setStartTime(null);
    setLastUpdateTime(null);
    lastRecordedRef.current = { phase: '', heuristic: null };
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

  // Request notification permission
  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  return {
    progress,
    progressHistory,
    isSubscribed,
    isTabActive,
    notificationPermission,
    requestNotificationPermission: requestPermission,
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
