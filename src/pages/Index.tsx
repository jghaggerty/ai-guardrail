import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeuristicFinding, EvaluationRun, EvaluationConfig } from '@/types/bias';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { HeuristicCard } from '@/components/HeuristicCard';
import { LongitudinalChart } from '@/components/LongitudinalChart';
import { RecommendationsList } from '@/components/RecommendationsList';
import { FindingDetailsDialog } from '@/components/FindingDetailsDialog';
import { HistoryPanel } from '@/components/HistoryPanel';
import { ReproPackMetadata } from '@/components/ReproPackMetadata';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluationProgress } from '@/hooks/useEvaluationProgress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { runFullEvaluation, ApiError, fetchReproPack, verifyReproPackSignature, ReproPackVerificationResult } from '@/lib/api';
import { Brain, Download, ToggleLeft, TrendingDown, Activity, LogOut, RotateCcw, History, X, Copy, Check, Info, Database } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const { signOut, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFilter = searchParams.get('model');
  
  const [evaluationRun, setEvaluationRun] = useState<EvaluationRun | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<HeuristicFinding | null>(null);
  const [viewMode, setViewMode] = useState<'technical' | 'simplified'>('technical');
  const [isRunning, setIsRunning] = useState(false);
  const [copiedReferenceId, setCopiedReferenceId] = useState(false);
  const [isDownloadingReproPack, setIsDownloadingReproPack] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ReproPackVerificationResult | null>(null);

  const clearModelFilter = () => {
    setSearchParams({});
  };

  useEffect(() => {
    setVerificationResult(null);
  }, [evaluationRun?.id]);
  
  // Real-time progress tracking
  const { 
    progressPercent, 
    message: progressMessage, 
    phaseLabel,
    currentHeuristic,
    testsCompleted,
    testsTotal,
    resetProgress,
    isSubscribed
  } = useEvaluationProgress({
    onComplete: () => {
      console.log('Evaluation completed via realtime');
    }
  });

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const handleStartEvaluation = async (config: EvaluationConfig) => {
    setIsRunning(true);
    resetProgress();

    toast.info('Starting diagnostic analysis...');

    try {
      const run = await runFullEvaluation(config);

      setEvaluationRun(run);
      toast.success('Analysis completed successfully');
    } catch (error) {
      console.error('Evaluation failed:', error);

      if (error instanceof ApiError) {
        toast.error(`Analysis failed: ${error.message}`);
      } else if (error instanceof Error) {
        toast.error(`Analysis failed: ${error.message}`);
      } else {
        toast.error('An unexpected error occurred during analysis');
      }
    } finally {
      setIsRunning(false);
      resetProgress();
    }
  };

  const handleExport = () => {
    toast.success('Report exported successfully');
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'technical' ? 'simplified' : 'technical');
    toast.info(`Switched to ${viewMode === 'technical' ? 'Simplified' : 'Technical'} View`);
  };

  const handleNewAnalysis = () => {
    setEvaluationRun(null);
    setSelectedFinding(null);
    resetProgress();
  };

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

  const handleDownloadReproPack = async () => {
    if (!evaluationRun?.reproPackId) {
      toast.error('No repro pack available for this analysis');
      return;
    }

    setIsDownloadingReproPack(true);
    try {
      const pack = await fetchReproPack(evaluationRun.reproPackId);
      const payload = pack.content ?? {
        id: pack.id,
        hash: pack.hash,
        signature: pack.signature,
        signingAuthority: pack.signingAuthority,
        createdAt: pack.createdAt,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `repro-pack-${pack.id}.json`;
      link.click();

      URL.revokeObjectURL(url);
      toast.success('Repro pack JSON downloaded');
    } catch (error) {
      console.error('Failed to download repro pack:', error);

      if (error instanceof ApiError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to download repro pack');
      }
    } finally {
      setIsDownloadingReproPack(false);
    }
  };

  const handleVerifyReproPack = async () => {
    if (!evaluationRun?.reproPackId) {
      toast.error('No repro pack available for verification');
      return;
    }

    setIsVerifyingSignature(true);
    try {
      const result = await verifyReproPackSignature(evaluationRun.reproPackId);
      setVerificationResult(result);
      toast[result.valid ? 'success' : 'error'](
        result.valid ? 'Signature verified successfully' : 'Signature validation failed'
      );
    } catch (error) {
      console.error('Failed to verify repro pack signature:', error);

      if (error instanceof ApiError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to verify repro pack signature');
      }
    } finally {
      setIsVerifyingSignature(false);
    }
  };

  const getStorageTypeLabel = (type?: string) => {
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

  // Display progress - use realtime when available, fallback to API progress
  const displayProgress = isRunning ? (progressPercent > 0 ? progressPercent : 5) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-card-foreground">
                  AI Bias & Heuristics Diagnostic Tool
                </h1>
                <p className="text-sm text-muted-foreground">
                  Cognitive bias analysis for responsible AI deployment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {evaluationRun && (
                <>
                  <Button variant="outline" size="sm" onClick={handleNewAnalysis}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    New Analysis
                  </Button>
                  <Button variant="outline" size="sm" onClick={toggleViewMode}>
                    <ToggleLeft className="w-4 h-4 mr-2" />
                    {viewMode === 'technical' ? 'Simplified' : 'Technical'} View
                  </Button>
                  <Button variant="default" size="sm" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut} title={user?.email}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {isRunning && (
          <Card className="p-6 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
              <div className="flex-1">
                <h3 className="font-semibold text-card-foreground">
                  {phaseLabel}
                  {currentHeuristic && (
                    <span className="ml-2 text-primary font-normal">
                      — {currentHeuristic.replace(/_/g, ' ')}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {progressMessage}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="mb-1">{displayProgress}%</Badge>
                {testsTotal > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {testsCompleted}/{testsTotal} tests
                  </p>
                )}
              </div>
            </div>
            <Progress value={displayProgress} className="h-2" />
            {isSubscribed && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live updates enabled
              </p>
            )}
          </Card>
        )}

        {!evaluationRun && !isRunning ? (
          <div className="space-y-8">
            {modelFilter && (
              <Card className="p-4 flex items-center justify-between bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Filtered</Badge>
                  <span className="text-sm text-card-foreground">
                    Showing evaluations for: <strong>{modelFilter}</strong>
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearModelFilter}>
                  <X className="w-4 h-4 mr-1" />
                  Clear Filter
                </Button>
              </Card>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="p-8 text-center">
                  <div className="max-w-2xl mx-auto">
                    <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                      <Brain className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-card-foreground mb-3">
                      Welcome to the AI Bias Diagnostic Platform
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Analyze cognitive heuristics in AI systems to detect bias patterns and receive 
                      actionable guidance for responsible AI deployment. Configure your evaluation 
                      parameters on the right to begin.
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-left">
                      <div className="p-4 bg-diagnostic-bg rounded-lg border border-diagnostic-border">
                        <TrendingDown className="w-5 h-5 text-primary mb-2" />
                        <h3 className="font-semibold text-sm text-card-foreground mb-1">
                          Heuristic Analysis
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Identify cognitive shortcuts and decision patterns
                        </p>
                      </div>
                      <div className="p-4 bg-diagnostic-bg rounded-lg border border-diagnostic-border">
                        <Activity className="w-5 h-5 text-secondary mb-2" />
                        <h3 className="font-semibold text-sm text-card-foreground mb-1">
                          Longitudinal Tracking
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Monitor behavioral trends over time
                        </p>
                      </div>
                      <div className="p-4 bg-diagnostic-bg rounded-lg border border-diagnostic-border">
                        <Download className="w-5 h-5 text-accent mb-2" />
                        <h3 className="font-semibold text-sm text-card-foreground mb-1">
                          Actionable Insights
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Get prioritized remediation guidance
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <div>
                <ConfigurationPanel
                  onStartEvaluation={handleStartEvaluation}
                  isRunning={isRunning}
                />
              </div>
            </div>
            
            {/* Historical analyses - filtered by model if param present */}
            <HistoryPanel 
              onLoadEvaluation={setEvaluationRun} 
              filterSystem={modelFilter || undefined}
            />
          </div>
        ) : evaluationRun && (
          <Tabs defaultValue="heuristics" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full grid-cols-4 max-w-3xl">
                <TabsTrigger value="heuristics">Heuristic Analysis</TabsTrigger>
                <TabsTrigger value="longitudinal">Longitudinal Tracking</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1">
                  <History className="w-4 h-4" />
                  History
                </TabsTrigger>
              </TabsList>
              {evaluationRun.evidenceReferenceId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="secondary" 
                        className="ml-4 flex items-center gap-1.5 cursor-help bg-primary/10 text-primary border-primary/20"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Collector Mode</span>
                        <span className="sm:hidden">Collector</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold">Evidence Collection Active</p>
                        <p className="text-sm">
                          This evaluation used collector mode. Evidence is stored in your {getStorageTypeLabel(evaluationRun.evidenceStorageType).toLowerCase()} storage system.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <TabsContent value="heuristics" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-semibold text-card-foreground">
                        Detected Heuristics
                      </h2>
                      {evaluationRun.evidenceReferenceId && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="secondary" 
                                className="text-xs flex items-center gap-1 cursor-help bg-primary/10 text-primary border-primary/20"
                              >
                                <Database className="w-3 h-3" />
                                Collector Mode
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold">Evidence Collection Enabled</p>
                                <p className="text-sm">
                                  This evaluation used collector mode. Raw prompts and outputs are stored in your {getStorageTypeLabel(evaluationRun.evidenceStorageType).toLowerCase()} storage system.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {evaluationRun.evidenceStorageType && (
                        <Badge variant="outline" className="text-xs">
                          {getStorageTypeLabel(evaluationRun.evidenceStorageType)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      System: {evaluationRun.config.systemName} • {evaluationRun.findings.length} findings
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                    <p className="text-3xl font-bold text-card-foreground">
                      {evaluationRun.overallScore.toFixed(1)}
                    </p>
                  </div>
                </div>
              </Card>

              {evaluationRun.evidenceReferenceId && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <h3 className="text-sm font-semibold text-card-foreground">
                                  Evidence Reference
                                </h3>
                                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-semibold">What are Reference IDs?</p>
                                <p className="text-sm">
                                  Reference IDs are unique identifiers that link BiasLens evaluation scores to the original 
                                  prompts and outputs stored in your customer-side storage system ({getStorageTypeLabel(evaluationRun.evidenceStorageType)}).
                                </p>
                                <p className="font-semibold mt-2">How to Use Them:</p>
                                <ul className="text-sm list-disc list-inside space-y-1">
                                  <li>Copy the reference ID using the copy button or by clicking the ID</li>
                                  <li>Search for this ID in your {getStorageTypeLabel(evaluationRun.evidenceStorageType)} storage system</li>
                                  <li>Use it to locate the exact prompts and outputs that generated each score</li>
                                  <li>Trace back to specific test cases for detailed analysis and debugging</li>
                                </ul>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {evaluationRun.evidenceStorageType && (
                          <Badge variant="secondary" className="text-xs">
                            {getStorageTypeLabel(evaluationRun.evidenceStorageType)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code 
                          className="text-xs bg-background px-2 py-1 rounded border font-mono text-muted-foreground flex-1 cursor-pointer hover:bg-muted/50 transition-colors select-all"
                          onClick={() => handleCopyReferenceId(evaluationRun.evidenceReferenceId!)}
                          title="Click to copy reference ID"
                        >
                          {evaluationRun.evidenceReferenceId}
                        </code>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleCopyReferenceId(evaluationRun.evidenceReferenceId!)}
                              >
                                {copiedReferenceId ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy reference ID</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="mt-2 p-2 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">
                          <span className="font-semibold text-card-foreground">Quick Guide:</span> Copy this reference ID and search for it in your {getStorageTypeLabel(evaluationRun.evidenceStorageType)} storage to access the raw prompts and outputs that generated these scores. This enables full traceability from BiasLens results back to the original evidence.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {evaluationRun.reproPackId && (
                <ReproPackMetadata
                  reproPackId={evaluationRun.reproPackId}
                  reproPackHash={evaluationRun.reproPackHash}
                  signature={evaluationRun.signature}
                  signingAuthority={evaluationRun.signingAuthority}
                  createdAt={evaluationRun.reproPackCreatedAt}
                  isDownloading={isDownloadingReproPack}
                  isVerifying={isVerifyingSignature}
                  verificationResult={verificationResult}
                  onDownload={handleDownloadReproPack}
                  onVerify={handleVerifyReproPack}
                  evidenceReferenceId={evaluationRun.evidenceReferenceId}
                  onCopyEvidence={handleCopyReferenceId}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {evaluationRun.findings.map(finding => (
                  <HeuristicCard
                    key={finding.id}
                    finding={finding}
                    onViewDetails={setSelectedFinding}
                    evidenceReferenceId={evaluationRun.evidenceReferenceId}
                    evidenceStorageType={evaluationRun.evidenceStorageType}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="longitudinal" className="space-y-6">
              {evaluationRun.evidenceReferenceId && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <h3 className="text-sm font-semibold text-card-foreground">
                                  Evidence Reference
                                </h3>
                                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-semibold">What are Reference IDs?</p>
                                <p className="text-sm">
                                  Reference IDs are unique identifiers that link BiasLens evaluation scores to the original 
                                  prompts and outputs stored in your customer-side storage system ({getStorageTypeLabel(evaluationRun.evidenceStorageType)}).
                                </p>
                                <p className="font-semibold mt-2">How to Use Them:</p>
                                <ul className="text-sm list-disc list-inside space-y-1">
                                  <li>Copy the reference ID using the copy button or by clicking the ID</li>
                                  <li>Search for this ID in your {getStorageTypeLabel(evaluationRun.evidenceStorageType)} storage system</li>
                                  <li>Use it to locate the exact prompts and outputs that generated each score</li>
                                  <li>Trace back to specific test cases for detailed analysis and debugging</li>
                                </ul>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {evaluationRun.evidenceStorageType && (
                          <Badge variant="secondary" className="text-xs">
                            {getStorageTypeLabel(evaluationRun.evidenceStorageType)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code 
                          className="text-xs bg-background px-2 py-1 rounded border font-mono text-muted-foreground flex-1 cursor-pointer hover:bg-muted/50 transition-colors select-all"
                          onClick={() => handleCopyReferenceId(evaluationRun.evidenceReferenceId!)}
                          title="Click to copy reference ID"
                        >
                          {evaluationRun.evidenceReferenceId}
                        </code>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleCopyReferenceId(evaluationRun.evidenceReferenceId!)}
                              >
                                {copiedReferenceId ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy reference ID</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="mt-2 p-2 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">
                          <span className="font-semibold text-card-foreground">Quick Guide:</span> Copy this reference ID and search for it in your {getStorageTypeLabel(evaluationRun.evidenceStorageType)} storage to access the raw prompts and outputs that generated these scores. This enables full traceability from BiasLens results back to the original evidence.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              <LongitudinalChart
                data={evaluationRun.baselineComparison}
                currentScore={evaluationRun.overallScore}
              />
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-6">
              {evaluationRun.evidenceReferenceId && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <h3 className="text-sm font-semibold text-card-foreground">
                                  Evidence Reference
                                </h3>
                                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-2">
                                <p className="font-semibold">What are Reference IDs?</p>
                                <p className="text-sm">
                                  Reference IDs are unique identifiers that link BiasLens evaluation scores to the original 
                                  prompts and outputs stored in your customer-side storage system ({getStorageTypeLabel(evaluationRun.evidenceStorageType)}).
                                </p>
                                <p className="font-semibold mt-2">How to Use Them:</p>
                                <ul className="text-sm list-disc list-inside space-y-1">
                                  <li>Copy the reference ID using the copy button or by clicking the ID</li>
                                  <li>Search for this ID in your {getStorageTypeLabel(evaluationRun.evidenceStorageType)} storage system</li>
                                  <li>Use it to locate the exact prompts and outputs that generated each score</li>
                                  <li>Trace back to specific test cases for detailed analysis and debugging</li>
                                </ul>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {evaluationRun.evidenceStorageType && (
                          <Badge variant="secondary" className="text-xs">
                            {getStorageTypeLabel(evaluationRun.evidenceStorageType)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code 
                          className="text-xs bg-background px-2 py-1 rounded border font-mono text-muted-foreground flex-1 cursor-pointer hover:bg-muted/50 transition-colors select-all"
                          onClick={() => handleCopyReferenceId(evaluationRun.evidenceReferenceId!)}
                          title="Click to copy reference ID"
                        >
                          {evaluationRun.evidenceReferenceId}
                        </code>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleCopyReferenceId(evaluationRun.evidenceReferenceId!)}
                              >
                                {copiedReferenceId ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy reference ID</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="mt-2 p-2 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">
                          <span className="font-semibold text-card-foreground">Quick Guide:</span> Copy this reference ID and search for it in your {getStorageTypeLabel(evaluationRun.evidenceStorageType)} storage to access the raw prompts and outputs that generated these scores. This enables full traceability from BiasLens results back to the original evidence.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              <RecommendationsList
                recommendations={evaluationRun.recommendations}
                viewMode={viewMode}
              />
            </TabsContent>

            <TabsContent value="history">
              <HistoryPanel 
                onLoadEvaluation={setEvaluationRun} 
                filterSystem={evaluationRun.config.systemName}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <FindingDetailsDialog
        finding={selectedFinding}
        open={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
};

export default Index;
