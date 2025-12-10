/**
 * Anchoring Bias Prompt Variations
 *
 * Provides prompt template variations for running multiple iterations
 * of anchoring bias tests with different phrasings.
 */

import type { TestCase, GeneratedPrompt } from '../../core/types.ts';

/**
 * Prompt variation strategies for anchoring tests.
 */
export interface PromptVariation {
  name: string;
  description: string;
  transform: (prompt: string, testCase: TestCase) => string;
}

/**
 * Introduction variations to prepend to prompts.
 */
const INTRO_VARIATIONS = [
  '', // No intro (original)
  'I need your expert analysis on this: ',
  'Please provide your professional assessment: ',
  'As an advisor, please evaluate: ',
  'I\'d like your honest opinion on: ',
];

/**
 * Question framing variations.
 */
const QUESTION_FRAMES = [
  { from: 'What would you consider', to: 'What do you think is' },
  { from: 'What would you consider', to: 'In your view, what would be' },
  { from: 'What would you consider', to: 'Based on your analysis, what is' },
  { from: 'What would you estimate', to: 'How would you assess' },
  { from: 'What would you estimate', to: 'What\'s your best estimate of' },
];

/**
 * Closing variations to append.
 */
const CLOSING_VARIATIONS = [
  '', // No closing (original)
  ' Be specific in your reasoning.',
  ' Please explain your thought process.',
  ' Walk me through your analysis.',
  ' Share your complete assessment.',
];

/**
 * Anchor emphasis variations - how prominently the anchor is presented.
 */
const ANCHOR_EMPHASIS = [
  { level: 'subtle', prefix: '', suffix: '' },
  { level: 'moderate', prefix: 'Note that ', suffix: '' },
  { level: 'prominent', prefix: 'Given that ', suffix: ', ' },
  { level: 'emphasized', prefix: 'The key figure to consider is ', suffix: '. ' },
];

/**
 * Generate a variation of the prompt for a specific iteration.
 */
export function generatePromptVariation(
  testCase: TestCase,
  iteration: number
): GeneratedPrompt {
  const totalVariations = INTRO_VARIATIONS.length *
    QUESTION_FRAMES.length *
    CLOSING_VARIATIONS.length;

  // Use iteration number to deterministically select variations
  const introIndex = iteration % INTRO_VARIATIONS.length;
  const questionIndex = Math.floor(iteration / INTRO_VARIATIONS.length) % QUESTION_FRAMES.length;
  const closingIndex = Math.floor(iteration / (INTRO_VARIATIONS.length * QUESTION_FRAMES.length)) %
    CLOSING_VARIATIONS.length;

  let modifiedPrompt = testCase.prompt;

  // Apply question frame variation
  const questionFrame = QUESTION_FRAMES[questionIndex];
  modifiedPrompt = modifiedPrompt.replace(
    new RegExp(questionFrame.from, 'gi'),
    questionFrame.to
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
      questionFrameVariation: questionIndex,
      closingVariation: closingIndex,
    },
  };
}

/**
 * Generate all prompt variations for a test case up to maxIterations.
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
 * Get variation metadata for logging/debugging.
 */
export function getVariationMetadata(iteration: number): Record<string, string> {
  const introIndex = iteration % INTRO_VARIATIONS.length;
  const questionIndex = Math.floor(iteration / INTRO_VARIATIONS.length) % QUESTION_FRAMES.length;
  const closingIndex = Math.floor(iteration / (INTRO_VARIATIONS.length * QUESTION_FRAMES.length)) %
    CLOSING_VARIATIONS.length;

  return {
    intro: INTRO_VARIATIONS[introIndex] || '(none)',
    questionFrame: JSON.stringify(QUESTION_FRAMES[questionIndex]),
    closing: CLOSING_VARIATIONS[closingIndex] || '(none)',
  };
}

/**
 * Specific prompts for testing anchor magnitude effects.
 * These vary the anchor value itself to test sensitivity.
 */
export const ANCHOR_MAGNITUDE_TEMPLATES = {
  salary_low: (base: number) => `$${(base * 0.5).toLocaleString()}`,
  salary_medium: (base: number) => `$${base.toLocaleString()}`,
  salary_high: (base: number) => `$${(base * 2).toLocaleString()}`,
  percentage_low: (base: number) => `${Math.round(base * 0.5)}%`,
  percentage_medium: (base: number) => `${base}%`,
  percentage_high: (base: number) => `${Math.min(100, Math.round(base * 2))}%`,
};

export default {
  generatePromptVariation,
  generateAllVariations,
  getVariationMetadata,
  INTRO_VARIATIONS,
  QUESTION_FRAMES,
  CLOSING_VARIATIONS,
  ANCHOR_MAGNITUDE_TEMPLATES,
};
