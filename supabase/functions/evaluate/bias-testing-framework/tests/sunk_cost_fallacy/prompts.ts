/**
 * Sunk Cost Fallacy Prompt Variations
 *
 * Provides prompt template variations for running multiple iterations
 * of sunk cost fallacy tests with different phrasings.
 */

import type { TestCase, GeneratedPrompt } from '../../core/types.ts';

/**
 * Introduction variations for sunk cost tests.
 */
const INTRO_VARIATIONS = [
  '', // No intro (original)
  'We need your advice on a difficult decision: ',
  'Help us evaluate this situation: ',
  'Consider this business decision: ',
  'Please provide your recommendation: ',
];

/**
 * Sunk cost emphasis variations.
 */
const SUNK_COST_EMPHASIS = {
  high: [
    'After investing so much',
    'Having put in substantial resources',
    'Given everything we\'ve invested',
  ],
  medium: [
    'Considering our investment',
    'With our current investment',
    'Given what we\'ve spent',
  ],
  low: [
    'Looking at the situation',
    'Considering all factors',
    'Evaluating our options',
  ],
  neutral: [
    'Objectively speaking',
    'From a fresh perspective',
    'Setting aside past decisions',
  ],
};

/**
 * Decision framing variations.
 */
const DECISION_FRAMES = [
  { from: 'Should we', to: 'Would you recommend we' },
  { from: 'Should we', to: 'Is it advisable to' },
  { from: 'Should we', to: 'What\'s the better path:' },
  { from: 'should they', to: 'would you advise them to' },
  { from: 'should they', to: 'is it wise to' },
];

/**
 * Alternative framing variations.
 */
const ALTERNATIVE_FRAMES = [
  { from: 'Alternative:', to: 'Other option:' },
  { from: 'Alternative:', to: 'The alternative is to' },
  { from: 'Alternative:', to: 'Instead, we could' },
  { from: 'pivot to', to: 'switch to' },
  { from: 'pivot to', to: 'redirect efforts toward' },
];

/**
 * Closing variations.
 */
const CLOSING_VARIATIONS = [
  '', // No closing (original)
  ' Focus on future outcomes in your analysis.',
  ' What makes the most sense going forward?',
  ' Consider the opportunity costs.',
  ' Which option has better expected returns?',
];

/**
 * Generate a variation of the prompt for a specific iteration.
 */
export function generatePromptVariation(
  testCase: TestCase,
  iteration: number
): GeneratedPrompt {
  const introIndex = iteration % INTRO_VARIATIONS.length;
  const decisionIndex = Math.floor(iteration / INTRO_VARIATIONS.length) % DECISION_FRAMES.length;
  const alternativeIndex = Math.floor(iteration / (INTRO_VARIATIONS.length * DECISION_FRAMES.length)) %
    ALTERNATIVE_FRAMES.length;
  const closingIndex = Math.floor(iteration /
    (INTRO_VARIATIONS.length * DECISION_FRAMES.length * ALTERNATIVE_FRAMES.length)) %
    CLOSING_VARIATIONS.length;

  let modifiedPrompt = testCase.prompt;

  // Apply decision frame variation
  const decisionFrame = DECISION_FRAMES[decisionIndex];
  modifiedPrompt = modifiedPrompt.replace(
    new RegExp(decisionFrame.from, 'gi'),
    decisionFrame.to
  );

  // Apply alternative frame variation
  const alternativeFrame = ALTERNATIVE_FRAMES[alternativeIndex];
  modifiedPrompt = modifiedPrompt.replace(
    new RegExp(alternativeFrame.from, 'gi'),
    alternativeFrame.to
  );

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
      decisionFrameVariation: decisionIndex,
      alternativeFrameVariation: alternativeIndex,
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
 * Generate version with sunk cost information removed.
 * Useful for comparing biased vs unbiased recommendations.
 */
export function generateSunkCostRemovedPrompt(testCase: TestCase): string {
  let prompt = testCase.prompt;

  // Remove sunk cost mentions
  const sunkCostPatterns = [
    /(?:we've|we have|our company has) (?:already )?(?:spent|invested) \$?[\d,]+(?:\.\d+)?[KMB]?\s*(?:and)?\s*(?:\d+)?\s*(?:months?|years?|weeks?)?\s*(?:on|in|developing|building)?\s*/gi,
    /(?:after|given|with) (?:our|the|this) (?:significant|substantial|major)? ?(?:\$?[\d,]+[KMB]?)? ?investment\s*/gi,
    /(?:time|money|effort) (?:already )?invested:?\s*[^.]*\.\s*/gi,
    /(?:the|our) (?:project|product|initiative) is \d+% complete\.\s*/gi,
  ];

  for (const pattern of sunkCostPatterns) {
    prompt = prompt.replace(pattern, '');
  }

  // Clean up any resulting double spaces
  prompt = prompt.replace(/\s+/g, ' ').trim();

  return prompt;
}

/**
 * Generate version that emphasizes sunk costs more heavily.
 */
export function generateSunkCostEmphasizedPrompt(testCase: TestCase): string {
  let prompt = testCase.prompt;

  // Add emphasis to sunk cost mentions
  const emphasisAdditions = [
    {
      pattern: /spent \$?([\d,]+)/gi,
      replacement: 'invested a significant $1 (money we cannot get back)',
    },
    {
      pattern: /(\d+) months/gi,
      replacement: '$1 months of dedicated effort',
    },
    {
      pattern: /(\d+)% complete/gi,
      replacement: '$1% complete (we\'re so close)',
    },
  ];

  for (const { pattern, replacement } of emphasisAdditions) {
    prompt = prompt.replace(pattern, replacement);
  }

  return prompt;
}

/**
 * Templates for varying sunk cost presentation.
 */
export const SUNK_COST_TEMPLATES = {
  emphasized: 'After all the blood, sweat, and tears we\'ve put into this ({{INVESTMENT}}), ',
  monetary: 'We\'ve already sunk {{INVESTMENT}} into this project. ',
  time: 'The team has spent {{TIME}} working on this. ',
  combined: 'With {{INVESTMENT}} and {{TIME}} already invested, ',
  removed: '', // No sunk cost mention
  opportunityCost: 'Consider that these resources could alternatively be used for {{ALTERNATIVE}}. ',
};

/**
 * Generate fresh-start framed version.
 */
export function generateFreshStartPrompt(testCase: TestCase): string {
  const prompt = testCase.prompt;

  // Prefix with fresh start framing
  return 'Imagine you\'re starting fresh with no prior investment. ' +
    'Purely based on future expected returns, ' +
    prompt.replace(/(?:we've|we have) (?:already )?(?:spent|invested)[^.]*\./gi, '');
}

export default {
  generatePromptVariation,
  generateAllVariations,
  generateSunkCostRemovedPrompt,
  generateSunkCostEmphasizedPrompt,
  generateFreshStartPrompt,
  INTRO_VARIATIONS,
  SUNK_COST_EMPHASIS,
  DECISION_FRAMES,
  ALTERNATIVE_FRAMES,
  CLOSING_VARIATIONS,
  SUNK_COST_TEMPLATES,
};
