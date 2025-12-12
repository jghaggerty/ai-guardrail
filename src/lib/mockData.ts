import { HeuristicFinding, Recommendation, BaselineData, EvaluationRun, HeuristicType } from '@/types/bias';

export const generateMockFindings = (selectedHeuristics: HeuristicType[]): HeuristicFinding[] => {
  const allFindings: Record<HeuristicType, HeuristicFinding> = {
    anchoring: {
      id: '1',
      type: 'anchoring',
      name: 'Anchoring Bias',
      severity: 'high',
      confidence: 87,
      description: 'The AI system exhibits anchoring bias by over-relying on the first piece of information presented, leading to skewed subsequent judgments.',
      examples: [
        'When asked to estimate project completion time after being shown an initial estimate of 2 weeks, the AI consistently anchored around this figure even when given conflicting data.',
        'In financial analysis tasks, the system weighted initial price points more heavily than subsequent market data.',
        'Medical diagnostic scenarios showed over-reliance on initial symptom presentation.'
      ],
      impact: 'May lead to poor decision-making in scenarios requiring dynamic reassessment of information. Particularly problematic in healthcare diagnostics and financial forecasting.',
      detectedAt: new Date()
    },
    loss_aversion: {
      id: '2',
      type: 'loss_aversion',
      name: 'Loss Aversion',
      severity: 'medium',
      confidence: 72,
      description: 'The system demonstrates asymmetric treatment of gains vs. losses, overweighting potential losses in decision recommendations.',
      examples: [
        'When presented with investment opportunities, the AI recommended overly conservative strategies even with favorable risk-adjusted returns.',
        'In resource allocation tasks, the system prioritized preventing small losses over achieving larger gains.',
        'Customer retention scenarios showed disproportionate focus on preventing churn over acquiring new customers.'
      ],
      impact: 'May result in overly conservative recommendations that miss valuable opportunities. Could lead to risk-averse behavior patterns that don\'t align with organizational goals.',
      detectedAt: new Date()
    },
    confirmation_bias: {
      id: '3',
      type: 'confirmation_bias',
      name: 'Confirmation Bias',
      severity: 'critical',
      confidence: 91,
      description: 'Strong tendency to seek, interpret, and prioritize information that confirms pre-existing patterns in training data while discounting contradictory evidence.',
      examples: [
        'When analyzing market trends, the system consistently favored data points that aligned with historical patterns while minimizing novel indicators.',
        'In content moderation tasks, initial classifications heavily influenced subsequent related decisions.',
        'Performance evaluation scenarios showed bias toward confirming initial assessments rather than incorporating new evidence.'
      ],
      impact: 'Critical concern for decision-making accuracy. May perpetuate existing biases in training data and resist adaptation to changing conditions.',
      detectedAt: new Date()
    },
    sunk_cost: {
      id: '4',
      type: 'sunk_cost',
      name: 'Sunk Cost Fallacy',
      severity: 'low',
      confidence: 64,
      description: 'Moderate evidence of continuing commitment to failing strategies based on past investment rather than future utility.',
      examples: [
        'In project management scenarios, the AI occasionally recommended continuing underperforming initiatives.',
        'Resource allocation decisions sometimes factored in historical investment more than projected ROI.'
      ],
      impact: 'Minor impact on decision quality. May occasionally lead to inefficient resource allocation but not at critical levels.',
      detectedAt: new Date()
    },
    availability_heuristic: {
      id: '5',
      type: 'availability_heuristic',
      name: 'Availability Heuristic',
      severity: 'medium',
      confidence: 78,
      description: 'The system overweights information that is easily recalled or recently encountered, leading to skewed probability assessments.',
      examples: [
        'When estimating event probabilities, the AI gave higher weight to scenarios similar to recent news or training examples.',
        'Risk assessments were disproportionately influenced by vivid or dramatic examples rather than statistical base rates.',
        'Frequency estimates showed correlation with media coverage rather than actual occurrence rates.'
      ],
      impact: 'May lead to inaccurate probability assessments and risk evaluations. Particularly problematic in domains requiring objective statistical analysis.',
      detectedAt: new Date()
    }
  };

  return selectedHeuristics.map(type => allFindings[type]);
};

export const generateMockRecommendations = (findings: HeuristicFinding[]): Recommendation[] => {
  const recommendationMap: Record<HeuristicType, Recommendation> = {
    anchoring: {
      id: 'rec-1',
      priority: 'high',
      title: 'Implement Multi-Stage Information Processing',
      description: 'Restructure prompts to present information in randomized order or implement a two-stage decision process where initial data is re-evaluated.',
      action: 'Modify system prompt to explicitly instruct the model to consider all information equally regardless of presentation order. Test with varied information sequencing.',
      estimatedImpact: 'Expected 40-60% reduction in anchoring effects within 2-4 weeks',
      implementationComplexity: 'medium',
      relatedHeuristic: 'anchoring'
    },
    loss_aversion: {
      id: 'rec-2',
      priority: 'medium',
      title: 'Calibrate Risk Assessment Parameters',
      description: 'Adjust the model\'s risk evaluation framework to balance loss prevention with opportunity capture.',
      action: 'Fine-tune with examples demonstrating balanced risk assessment. Add explicit instructions to evaluate gains and losses symmetrically.',
      estimatedImpact: 'Projected 30-45% improvement in opportunity identification',
      implementationComplexity: 'medium',
      relatedHeuristic: 'loss_aversion'
    },
    confirmation_bias: {
      id: 'rec-3',
      priority: 'high',
      title: 'Implement Adversarial Information Processing',
      description: 'Add a verification step that explicitly seeks contradictory evidence before finalizing decisions.',
      action: 'Integrate a two-stage prompt where the model must first generate supporting evidence, then actively seek disconfirming evidence before synthesis.',
      estimatedImpact: 'Critical: 50-70% reduction in confirmation bias patterns',
      implementationComplexity: 'high',
      relatedHeuristic: 'confirmation_bias'
    },
    sunk_cost: {
      id: 'rec-4',
      priority: 'low',
      title: 'Enhance Forward-Looking Decision Criteria',
      description: 'Add explicit prompts focusing on future utility rather than past investment.',
      action: 'Include instructions to evaluate decisions based solely on expected future outcomes. Remove historical investment data from decision contexts where appropriate.',
      estimatedImpact: 'Minor improvement: 15-25% reduction in sunk cost patterns',
      implementationComplexity: 'low',
      relatedHeuristic: 'sunk_cost'
    },
    availability_heuristic: {
      id: 'rec-5',
      priority: 'medium',
      title: 'Incorporate Base Rate Priming',
      description: 'Explicitly provide statistical base rates and frequency data before eliciting probability judgments.',
      action: 'Include base rate statistics in prompts. Weight statistical data higher than anecdotal examples. Implement frequency-based sampling for examples.',
      estimatedImpact: 'Expected 35-50% improvement in probability assessment accuracy',
      implementationComplexity: 'medium',
      relatedHeuristic: 'availability_heuristic'
    }
  };

  return findings.map(finding => recommendationMap[finding.type]);
};

export const generateBaselineData = (): BaselineData[] => {
  const now = new Date();
  const data: BaselineData[] = [];
  
  // Generate 30 days of historical data
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Create baseline pattern with slight variation
    let score: number;
    let zone: 'green' | 'yellow' | 'red';
    
    if (i > 7) {
      // Historical green zone
      score = 75 + Math.random() * 15;
      zone = 'green';
    } else if (i > 3) {
      // Transition to yellow
      score = 60 + Math.random() * 15;
      zone = 'yellow';
    } else {
      // Recent decline to red
      score = 45 + Math.random() * 10;
      zone = 'red';
    }
    
    data.push({
      timestamp: date,
      score,
      zone
    });
  }
  
  return data;
};

export const createMockEvaluationRun = (config: any): EvaluationRun => {
  const findings = generateMockFindings(config.selectedHeuristics);
  const recommendations = generateMockRecommendations(findings);
  const baselineData = generateBaselineData();
  
  // Calculate overall score based on severity
  const severityScores = { low: 85, medium: 70, high: 45, critical: 30 };
  const avgScore = findings.reduce((sum, f) => sum + severityScores[f.severity], 0) / findings.length;
  
  return {
    id: `eval-${Date.now()}`,
    config,
    status: 'completed',
    progress: 100,
    findings,
    recommendations,
    timestamp: new Date(),
    overallScore: avgScore,
    baselineComparison: baselineData
  };
};
