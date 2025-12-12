import { describe, it, expect } from 'vitest';
import {
  generateMockFindings,
  generateMockRecommendations,
  generateBaselineData,
  createMockEvaluationRun,
} from './mockData';
import type { HeuristicType } from '@/types/bias';

describe('Mock Data Generation', () => {
  describe('generateMockFindings', () => {
    it('generates findings for all selected heuristics', () => {
      const selectedHeuristics: HeuristicType[] = ['anchoring', 'loss_aversion'];
      const findings = generateMockFindings(selectedHeuristics);

      expect(findings).toHaveLength(2);
      expect(findings[0].type).toBe('anchoring');
      expect(findings[1].type).toBe('loss_aversion');
    });

    it('generates findings for all heuristic types including new ones', () => {
      const allHeuristics: HeuristicType[] = [
        'anchoring',
        'loss_aversion',
        'confirmation_bias',
        'sunk_cost',
        'availability_heuristic',
      ];

      const findings = generateMockFindings(allHeuristics);

      expect(findings).toHaveLength(5);
      allHeuristics.forEach((type, index) => {
        expect(findings[index].type).toBe(type);
        expect(findings[index].name).toBeDefined();
        expect(findings[index].severity).toBeDefined();
        expect(findings[index].confidence).toBeGreaterThan(0);
        expect(findings[index].examples.length).toBeGreaterThan(0);
      });
    });

    it('generates correct finding structure', () => {
      const findings = generateMockFindings(['anchoring']);
      const finding = findings[0];

      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('type');
      expect(finding).toHaveProperty('name');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('confidence');
      expect(finding).toHaveProperty('description');
      expect(finding).toHaveProperty('examples');
      expect(finding).toHaveProperty('impact');
      expect(finding).toHaveProperty('detectedAt');

      expect(finding.detectedAt).toBeInstanceOf(Date);
      expect(Array.isArray(finding.examples)).toBe(true);
    });

    it('availability_heuristic finding has correct properties', () => {
      const findings = generateMockFindings(['availability_heuristic']);
      const finding = findings[0];

      expect(finding.type).toBe('availability_heuristic');
      expect(finding.name).toBe('Availability Heuristic');
      expect(finding.severity).toBe('medium');
      expect(finding.examples.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateMockRecommendations', () => {
    it('generates recommendations for all findings', () => {
      const findings = generateMockFindings(['anchoring', 'confirmation_bias']);
      const recommendations = generateMockRecommendations(findings);

      expect(recommendations).toHaveLength(2);
    });

    it('generates recommendation for availability_heuristic', () => {
      const findings = generateMockFindings(['availability_heuristic']);
      const recommendations = generateMockRecommendations(findings);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].relatedHeuristic).toBe('availability_heuristic');
      expect(recommendations[0].title).toBe('Incorporate Base Rate Priming');
    });

    it('recommendations have correct structure', () => {
      const findings = generateMockFindings(['anchoring']);
      const recommendations = generateMockRecommendations(findings);
      const rec = recommendations[0];

      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('priority');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('description');
      expect(rec).toHaveProperty('action');
      expect(rec).toHaveProperty('estimatedImpact');
      expect(rec).toHaveProperty('implementationComplexity');
      expect(rec).toHaveProperty('relatedHeuristic');

      expect(['high', 'medium', 'low']).toContain(rec.priority);
      expect(['high', 'medium', 'low']).toContain(rec.implementationComplexity);
    });
  });

  describe('generateBaselineData', () => {
    it('generates 30 days of data', () => {
      const data = generateBaselineData();
      expect(data).toHaveLength(30);
    });

    it('data points have correct structure', () => {
      const data = generateBaselineData();

      data.forEach((point) => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('score');
        expect(point).toHaveProperty('zone');

        expect(point.timestamp).toBeInstanceOf(Date);
        expect(typeof point.score).toBe('number');
        expect(['green', 'yellow', 'red']).toContain(point.zone);
      });
    });

    it('scores are within valid range', () => {
      const data = generateBaselineData();

      data.forEach((point) => {
        expect(point.score).toBeGreaterThanOrEqual(0);
        expect(point.score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('createMockEvaluationRun', () => {
    it('creates complete evaluation run with all heuristics', () => {
      const config = {
        selectedHeuristics: ['anchoring', 'confirmation_bias', 'availability_heuristic'] as HeuristicType[],
        iterations: 100,
        systemName: 'test-system',
      };

      const run = createMockEvaluationRun(config);

      expect(run.id).toContain('eval-');
      expect(run.config).toEqual(config);
      expect(run.status).toBe('completed');
      expect(run.progress).toBe(100);
      expect(run.findings).toHaveLength(3);
      expect(run.recommendations).toHaveLength(3);
      expect(run.timestamp).toBeInstanceOf(Date);
      expect(run.overallScore).toBeGreaterThan(0);
      expect(run.baselineComparison).toHaveLength(30);
    });

    it('calculates overall score based on severity', () => {
      // Test with all low severity findings
      const lowConfig = {
        selectedHeuristics: ['sunk_cost'] as HeuristicType[],
        iterations: 100,
        systemName: 'test',
      };
      const lowRun = createMockEvaluationRun(lowConfig);

      // Test with high severity findings
      const highConfig = {
        selectedHeuristics: ['anchoring'] as HeuristicType[],
        iterations: 100,
        systemName: 'test',
      };
      const highRun = createMockEvaluationRun(highConfig);

      // Low severity should have higher score than high severity
      expect(lowRun.overallScore).toBeGreaterThan(highRun.overallScore);
    });
  });
});
