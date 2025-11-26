export type HeuristicType = 'anchoring' | 'loss_aversion' | 'confirmation' | 'sunk_cost';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type ZoneStatus = 'green' | 'yellow' | 'red';

export interface HeuristicFinding {
  id: string;
  type: HeuristicType;
  name: string;
  severity: SeverityLevel;
  confidence: number;
  description: string;
  examples: string[];
  impact: string;
  detectedAt: Date;
}

export interface BaselineData {
  timestamp: Date;
  score: number;
  zone: ZoneStatus;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  estimatedImpact: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  relatedHeuristic: HeuristicType;
}

export interface EvaluationConfig {
  selectedHeuristics: HeuristicType[];
  iterations: number;
  systemName: string;
}

export interface EvaluationRun {
  id: string;
  config: EvaluationConfig;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  findings: HeuristicFinding[];
  recommendations: Recommendation[];
  timestamp: Date;
  overallScore: number;
  baselineComparison: BaselineData[];
}
