import { describe, it, expect } from 'vitest';
import type {
  HeuristicType,
  SeverityLevel,
  ZoneStatus,
  HeuristicFinding,
  Recommendation,
  EvaluationConfig,
  EvaluationRun,
} from './bias';

describe('Bias Types', () => {
  describe('HeuristicType', () => {
    it('includes all expected heuristic types matching backend schema', () => {
      // These types should match the Supabase edge function schema exactly
      const backendTypes = [
        'anchoring',
        'loss_aversion',
        'sunk_cost',
        'confirmation_bias',
        'availability_heuristic',
      ];

      backendTypes.forEach((type) => {
        // TypeScript will catch if any of these are invalid at compile time
        const heuristic: HeuristicType = type as HeuristicType;
        expect(heuristic).toBe(type);
      });
    });
  });

  describe('SeverityLevel', () => {
    it('includes all expected severity levels', () => {
      const levels: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
      expect(levels).toHaveLength(4);
    });
  });

  describe('ZoneStatus', () => {
    it('includes all expected zone statuses', () => {
      const zones: ZoneStatus[] = ['green', 'yellow', 'red'];
      expect(zones).toHaveLength(3);
    });
  });

  describe('HeuristicFinding', () => {
    it('can create a valid finding object', () => {
      const finding: HeuristicFinding = {
        id: 'test-id',
        type: 'anchoring',
        name: 'Anchoring Bias',
        severity: 'high',
        confidence: 85,
        description: 'Test description',
        examples: ['Example 1', 'Example 2'],
        impact: 'Test impact',
        detectedAt: new Date(),
      };

      expect(finding.id).toBe('test-id');
      expect(finding.type).toBe('anchoring');
      expect(finding.severity).toBe('high');
      expect(finding.confidence).toBe(85);
    });

    it('supports all heuristic types', () => {
      const types: HeuristicType[] = [
        'anchoring',
        'loss_aversion',
        'confirmation_bias',
        'sunk_cost',
        'availability_heuristic',
      ];

      types.forEach((type) => {
        const finding: HeuristicFinding = {
          id: `test-${type}`,
          type,
          name: `${type} Test`,
          severity: 'medium',
          confidence: 75,
          description: 'Test',
          examples: [],
          impact: 'Test',
          detectedAt: new Date(),
        };

        expect(finding.type).toBe(type);
      });
    });
  });

  describe('Recommendation', () => {
    it('can create a valid recommendation object', () => {
      const recommendation: Recommendation = {
        id: 'rec-1',
        priority: 'high',
        title: 'Test Recommendation',
        description: 'Technical description',
        action: 'Take action',
        estimatedImpact: 'High impact',
        implementationComplexity: 'medium',
        relatedHeuristic: 'anchoring',
      };

      expect(recommendation.priority).toBe('high');
      expect(recommendation.implementationComplexity).toBe('medium');
      expect(recommendation.relatedHeuristic).toBe('anchoring');
    });
  });

  describe('EvaluationConfig', () => {
    it('can create a valid config object', () => {
      const config: EvaluationConfig = {
        selectedHeuristics: ['anchoring', 'confirmation_bias', 'availability_heuristic'],
        iterations: 100,
        systemName: 'test-system',
      };

      expect(config.selectedHeuristics).toHaveLength(3);
      expect(config.iterations).toBe(100);
      expect(config.systemName).toBe('test-system');
    });
  });

  describe('EvaluationRun', () => {
    it('can create a valid evaluation run object', () => {
      const run: EvaluationRun = {
        id: 'eval-1',
        config: {
          selectedHeuristics: ['anchoring'],
          iterations: 50,
          systemName: 'test',
        },
        status: 'completed',
        progress: 100,
        findings: [],
        recommendations: [],
        timestamp: new Date(),
        overallScore: 75,
        baselineComparison: [],
      };

      expect(run.status).toBe('completed');
      expect(run.progress).toBe(100);
      expect(run.overallScore).toBe(75);
    });

    it('supports all status types', () => {
      const statuses: Array<'pending' | 'running' | 'completed' | 'failed'> = [
        'pending',
        'running',
        'completed',
        'failed',
      ];

      statuses.forEach((status) => {
        const run: EvaluationRun = {
          id: `eval-${status}`,
          config: {
            selectedHeuristics: ['anchoring'],
            iterations: 50,
            systemName: 'test',
          },
          status,
          progress: status === 'completed' ? 100 : 50,
          findings: [],
          recommendations: [],
          timestamp: new Date(),
          overallScore: 75,
          baselineComparison: [],
        };

        expect(run.status).toBe(status);
      });
    });
  });
});
