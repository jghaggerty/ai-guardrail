import { useState } from 'react';
import { HeuristicFinding, EvaluationRun } from '@/types/bias';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { HeuristicCard } from '@/components/HeuristicCard';
import { LongitudinalChart } from '@/components/LongitudinalChart';
import { RecommendationsList } from '@/components/RecommendationsList';
import { FindingDetailsDialog } from '@/components/FindingDetailsDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createMockEvaluationRun } from '@/lib/mockData';
import { Brain, Download, ToggleLeft, TrendingDown, Activity } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [evaluationRun, setEvaluationRun] = useState<EvaluationRun | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<HeuristicFinding | null>(null);
  const [viewMode, setViewMode] = useState<'technical' | 'simplified'>('technical');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartEvaluation = async (config: any) => {
    setIsRunning(true);
    setProgress(0);
    
    // Simulate analysis progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Simulate analysis time
    setTimeout(() => {
      const run = createMockEvaluationRun(config);
      setEvaluationRun(run);
      setIsRunning(false);
      clearInterval(interval);
      setProgress(100);
      toast.success('Analysis completed successfully');
    }, 3000);

    toast.info('Starting diagnostic analysis...');
  };

  const handleExport = () => {
    toast.success('Report exported successfully');
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'technical' ? 'simplified' : 'technical');
    toast.info(`Switched to ${viewMode === 'technical' ? 'Simplified' : 'Technical'} View`);
  };

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
            {evaluationRun && (
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={toggleViewMode}>
                  <ToggleLeft className="w-4 h-4 mr-2" />
                  {viewMode === 'technical' ? 'Simplified' : 'Technical'} View
                </Button>
                <Button variant="default" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            )}
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
                  Running Diagnostic Analysis...
                </h3>
                <p className="text-sm text-muted-foreground">
                  Processing behavioral assessment tests
                </p>
              </div>
              <Badge variant="outline">{progress}%</Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </Card>
        )}

        {!evaluationRun && !isRunning ? (
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
        ) : evaluationRun && (
          <Tabs defaultValue="heuristics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl">
              <TabsTrigger value="heuristics">Heuristic Analysis</TabsTrigger>
              <TabsTrigger value="longitudinal">Longitudinal Tracking</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="heuristics" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-card-foreground">
                      Detected Heuristics
                    </h2>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {evaluationRun.findings.map(finding => (
                  <HeuristicCard
                    key={finding.id}
                    finding={finding}
                    onViewDetails={setSelectedFinding}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="longitudinal">
              <LongitudinalChart
                data={evaluationRun.baselineComparison}
                currentScore={evaluationRun.overallScore}
              />
            </TabsContent>

            <TabsContent value="recommendations">
              <RecommendationsList
                recommendations={evaluationRun.recommendations}
                viewMode={viewMode}
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
