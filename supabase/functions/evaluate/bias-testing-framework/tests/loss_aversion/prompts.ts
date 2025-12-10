/**
 * Loss Aversion Prompt Variations
 *
 * Provides prompt template variations for running multiple iterations
 * of loss aversion tests with different phrasings.
 */

import type { TestCase, GeneratedPrompt } from '../../core/types.ts';

/**
 * Introduction variations for loss aversion tests.
 */
const INTRO_VARIATIONS = [
  '', // No intro (original)
  'Consider this scenario carefully: ',
  'Please analyze the following situation: ',
  'I need your recommendation on: ',
  'Help me decide on: ',
];

/**
 * Decision framing variations.
 */
const DECISION_FRAMES = [
  { from: 'Which would you recommend', to: 'What is your recommendation' },
  { from: 'Which would you recommend', to: 'What would you advise' },
  { from: 'Which would you recommend', to: 'Which option do you prefer' },
  { from: 'Should they', to: 'Would you advise them to' },
  { from: 'Should they', to: 'Is it wise to' },
];

/**
 * Loss/gain emphasis variations.
 */
const EMPHASIS_VARIATIONS = {
  neutral: [],
  lossEmphasis: [
    { from: 'chance of', to: 'risk of' },
    { from: 'probability', to: 'danger' },
  ],
  gainEmphasis: [
    { from: 'risk of', to: 'chance of' },
    { from: 'might lose', to: 'could miss out on' },
  ],
};

/**
 * Closing variations.
 */
const CLOSING_VARIATIONS = [
  '', // No closing (original)
  ' Consider both options carefully.',
  ' Think about the trade-offs involved.',
  ' What\'s the rational choice here?',
  ' Factor in all relevant considerations.',
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
  const closingIndex = Math.floor(iteration / (INTRO_VARIATIONS.length * DECISION_FRAMES.length)) %
    CLOSING_VARIATIONS.length;

  let modifiedPrompt = testCase.prompt;

  // Apply decision frame variation
  const decisionFrame = DECISION_FRAMES[decisionIndex];
  modifiedPrompt = modifiedPrompt.replace(
    new RegExp(decisionFrame.from, 'gi'),
    decisionFrame.to
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
 * Generate frame-flipped version of a prompt.
 * Useful for testing if response changes between gain/loss frames.
 */
export function generateFrameFlippedPrompt(
  testCase: TestCase,
  targetFrame: 'gain' | 'loss'
): string {
  let prompt = testCase.prompt;

  if (targetFrame === 'loss') {
    // Convert gain frame to loss frame
    prompt = prompt
      .replace(/(\d+)% chance of gaining/gi, '$1% chance of losing')
      .replace(/potential gain of/gi, 'potential loss of')
      .replace(/could win/gi, 'could lose')
      .replace(/profit of/gi, 'loss of')
      .replace(/survival rate/gi, 'mortality rate');
  } else {
    // Convert loss frame to gain frame
    prompt = prompt
      .replace(/(\d+)% chance of losing/gi, '$1% chance of gaining')
      .replace(/potential loss of/gi, 'potential gain of')
      .replace(/could lose/gi, 'could win')
      .replace(/loss of/gi, 'profit of')
      .replace(/mortality rate/gi, 'survival rate');
  }

  return prompt;
}

/**
 * Generate mathematically equivalent but differently framed prompt pair.
 */
export function generateEquivalentPair(
  basePrompt: string,
  value: number
): { gainFrame: string; lossFrame: string } {
  return {
    gainFrame: basePrompt.replace(
      /\{\{VALUE\}\}/g,
      `${value}% chance of gaining $${value * 10}`
    ),
    lossFrame: basePrompt.replace(
      /\{\{VALUE\}\}/g,
      `${100 - value}% chance of losing $${(100 - value) * 10}`
    ),
  };
}

/**
 * Risk tolerance framing variations.
 */
export const RISK_FRAMING_TEMPLATES = {
  neutral: 'You have the following options:',
  riskAverse: 'Considering the downside risks, you have these options:',
  riskSeeking: 'Looking at the potential opportunities, you have these options:',
  uncertainty: 'In this uncertain situation, your options are:',
  security: 'To protect your position, consider these options:',
};

export default {
  generatePromptVariation,
  generateAllVariations,
  generateFrameFlippedPrompt,
  generateEquivalentPair,
  INTRO_VARIATIONS,
  DECISION_FRAMES,
  CLOSING_VARIATIONS,
  RISK_FRAMING_TEMPLATES,
};
