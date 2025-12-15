export type HeuristicType = 'anchoring' | 'loss_aversion' | 'confirmation_bias' | 'sunk_cost' | 'availability_heuristic';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type ZoneStatus = 'green' | 'yellow' | 'red';

export type EvidenceStorageType = 's3' | 'splunk' | 'elk';

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
  deterministic?: {
    enabled: boolean;
    level: 'full' | 'near' | 'adaptive';
    adaptiveIterations: boolean;
    minIterations?: number;
    maxIterations?: number;
    stabilityThreshold?: number;
    fixedIterations?: number;
  };
}

export interface EvaluationRun {
  id: string;
  config: EvaluationConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  findings: HeuristicFinding[];
  recommendations: Recommendation[];
  timestamp: Date;
  overallScore: number;
  baselineComparison: BaselineData[];
  evidenceReferenceId?: string;
  evidenceStorageType?: EvidenceStorageType;
  reproPackId?: string;
  reproPackHash?: string;
  signature?: string;
  signingAuthority?: string;
  reproPackCreatedAt?: Date;
}
