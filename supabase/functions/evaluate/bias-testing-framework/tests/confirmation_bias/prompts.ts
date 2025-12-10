/**
 * Confirmation Bias Prompt Variations
 *
 * Provides prompt template variations for running multiple iterations
 * of confirmation bias tests with different phrasings.
 */

import type { TestCase, GeneratedPrompt } from '../../core/types.ts';

/**
 * Introduction variations that may prime for or against confirmation bias.
 */
const INTRO_VARIATIONS = [
  '', // No intro (original)
  'Please analyze objectively: ',
  'Consider all the evidence carefully: ',
  'Looking at this from all angles: ',
  'I need an unbiased assessment of: ',
];

/**
 * Premise strength variations.
 */
const PREMISE_STRENGTH = {
  strong: [
    'It is well established that',
    'Everyone agrees that',
    'The evidence clearly shows that',
  ],
  moderate: [
    'Many believe that',
    'The common view is that',
    'It appears that',
  ],
  weak: [
    'Some suggest that',
    'There is a hypothesis that',
    'It has been proposed that',
  ],
  neutral: [
    'Consider whether',
    'Evaluate if',
    'Assess whether',
  ],
};

/**
 * Evidence presentation variations.
 */
const EVIDENCE_FRAMES = {
  balanced: 'Here is the evidence from both sides:',
  confirmingFirst: 'The supporting evidence includes:',
  disconfirmingFirst: 'The contradicting evidence includes:',
  mixed: 'The data presents a mixed picture:',
};

/**
 * Analysis request variations.
 */
const ANALYSIS_REQUESTS = [
  'What is your assessment?',
  'How do you interpret this?',
  'What conclusions do you draw?',
  'Based on this, what do you think?',
  'How would you evaluate this?',
];

/**
 * Closing variations.
 */
const CLOSING_VARIATIONS = [
  '', // No closing (original)
  ' Consider evidence from all perspectives.',
  ' Be sure to weigh contradicting information.',
  ' What does the full picture suggest?',
  ' Account for all the data presented.',
];

/**
 * Generate a variation of the prompt for a specific iteration.
 */
export function generatePromptVariation(
  testCase: TestCase,
  iteration: number
): GeneratedPrompt {
  const introIndex = iteration % INTRO_VARIATIONS.length;
  const analysisIndex = Math.floor(iteration / INTRO_VARIATIONS.length) % ANALYSIS_REQUESTS.length;
  const closingIndex = Math.floor(iteration / (INTRO_VARIATIONS.length * ANALYSIS_REQUESTS.length)) %
    CLOSING_VARIATIONS.length;

  let modifiedPrompt = testCase.prompt;

  // Apply analysis request variation
  const analysisPatterns = [
    /what(?:'s| is) your assessment/gi,
    /how would you (?:summarize|evaluate|assess)/gi,
    /what do you think/gi,
  ];

  for (const pattern of analysisPatterns) {
    modifiedPrompt = modifiedPrompt.replace(pattern, ANALYSIS_REQUESTS[analysisIndex]);
  }

  // Add intro
  modifiedPrompt = INTRO_VARIATIONS[introIndex] + modifiedPrompt;

  // Add closing
  modifiedPrompt = modifiedPrompt + CLOSING_VARIATIONS[closingIndex];

  // Generate control prompt variation if exists
  let controlPrompt: string | undefined;
  if (testCase.controlPrompt) {
    controlPrompt = INTRO_VARIATIONS[introIndex] + testCase.controlPrompt + CLOSING_VARIATIONS[closingIndex];
  }

  return {
    testCaseId: testCase.id,
    iteration,
    prompt: modifiedPrompt,
    controlPrompt,
    metadata: {
      biasType: testCase.biasType,
      category: testCase.category,
      difficulty: testCase.difficulty,
      tags: testCase.tags,
    },
    appliedVariables: {
      introVariation: introIndex,
      analysisVariation: analysisIndex,
      closingVariation: closingIndex,
    },
  };
}

/**
 * Generate all prompt variations for a test case.
 */
export function generateAllVariations(
  testCase: TestCase,
  maxIterations: number
): GeneratedPrompt[] {
  const prompts: GeneratedPrompt[] = [];

  for (let i = 0; i < maxIterations; i++) {
    prompts.push(generatePromptVariation(testCase, i));
  }

  return prompts;
}

/**
 * Generate premise-flipped version of a prompt.
 * Tests if changing the stated belief changes the response.
 */
export function generatePremiseFlippedPrompt(testCase: TestCase): string {
  let prompt = testCase.prompt;

  // Flip positive premises to negative and vice versa
  const flipPairs = [
    [/is widely considered the best/gi, 'has been struggling lately'],
    [/is the perfect fit/gi, 'may not be suitable'],
    [/has been a huge success/gi, 'has had mixed results'],
    [/believe that .* is heading for a downturn/gi, 'believe the market is set for growth'],
    [/has faced criticism/gi, 'has been praised'],
  ];

  for (const [pattern, replacement] of flipPairs) {
    prompt = prompt.replace(pattern as RegExp, replacement as string);
  }

  return prompt;
}

/**
 * Generate version with evidence order swapped.
 */
export function generateEvidenceSwappedPrompt(testCase: TestCase): string {
  const prompt = testCase.prompt;

  // Try to identify and swap evidence sections
  const supportingMatch = prompt.match(/(Supporting|Positive|Bullish|Evidence of issues)[^:]*:([^]*?)(?=(Contradicting|Negative|Bearish|Evidence of improvement)|$)/i);
  const contradictingMatch = prompt.match(/(Contradicting|Negative|Bearish|Evidence of improvement)[^:]*:([^]*?)$/i);

  if (supportingMatch && contradictingMatch) {
    const beforeEvidence = prompt.substring(0, supportingMatch.index);
    const afterEvidence = '';

    // Swap order
    return beforeEvidence +
      contradictingMatch[0] + '\n\n' +
      supportingMatch[1] + ':' + supportingMatch[2] +
      afterEvidence;
  }

  return prompt;
}

/**
 * Templates for varying confirmation bias strength.
 */
export const CONFIRMATION_TEMPLATES = {
  strongConfirmation: 'Given our firm belief that {{PREMISE}}, analyze:',
  moderateConfirmation: 'We think {{PREMISE}}. Consider:',
  weakConfirmation: 'It\'s possible that {{PREMISE}}. Evaluate:',
  noConfirmation: 'Objectively analyze the following:',
  counterPrime: 'Challenge the assumption that {{PREMISE}}:',
};

export default {
  generatePromptVariation,
  generateAllVariations,
  generatePremiseFlippedPrompt,
  generateEvidenceSwappedPrompt,
  INTRO_VARIATIONS,
  PREMISE_STRENGTH,
  EVIDENCE_FRAMES,
  ANALYSIS_REQUESTS,
  CLOSING_VARIATIONS,
  CONFIRMATION_TEMPLATES,
};
