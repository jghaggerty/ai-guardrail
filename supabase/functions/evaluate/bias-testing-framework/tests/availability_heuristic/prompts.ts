/**
 * Availability Heuristic Prompt Variations
 *
 * Provides prompt template variations for running multiple iterations
 * of availability heuristic tests with different phrasings.
 */

import type { TestCase, GeneratedPrompt } from '../../core/types.ts';

/**
 * Introduction variations for availability heuristic tests.
 */
const INTRO_VARIATIONS = [
  '', // No intro (original)
  'Based on your knowledge, ',
  'Please assess the following: ',
  'I need your analysis on: ',
  'Help me understand: ',
];

/**
 * Recency emphasis variations.
 */
const RECENCY_EMPHASIS = {
  high: [
    'Just recently',
    'In the past few days',
    'This just happened',
  ],
  medium: [
    'Recently',
    'Not long ago',
    'In recent memory',
  ],
  low: [
    'At some point',
    'There have been instances where',
    'Occasionally',
  ],
  historical: [
    'Looking at the historical record',
    'Over the long term',
    'Based on systematic data',
  ],
};

/**
 * Vividness variations for describing events.
 */
const VIVIDNESS_FRAMES = {
  vivid: [
    'dramatic footage of',
    'shocking images of',
    'viral videos showing',
    'horrifying scenes of',
  ],
  neutral: [
    'reports of',
    'instances of',
    'cases of',
    'occurrences of',
  ],
  statistical: [
    'data showing',
    'statistics indicating',
    'research documenting',
    'surveys reporting',
  ],
};

/**
 * Question framing variations.
 */
const QUESTION_FRAMES = [
  { from: 'how would you assess', to: 'what\'s your assessment of' },
  { from: 'how would you assess', to: 'how do you evaluate' },
  { from: 'how common is', to: 'what\'s the frequency of' },
  { from: 'how common is', to: 'how prevalent is' },
  { from: 'what percentage', to: 'what proportion' },
];

/**
 * Closing variations.
 */
const CLOSING_VARIATIONS = [
  '', // No closing (original)
  ' Base your answer on statistical evidence.',
  ' Consider the base rates.',
  ' Think about this systematically.',
  ' Use data to inform your assessment.',
];

/**
 * Generate a variation of the prompt for a specific iteration.
 */
export function generatePromptVariation(
  testCase: TestCase,
  iteration: number
): GeneratedPrompt {
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
 * Generate version with recent event information removed.
 * Tests if removing vivid examples changes probability estimates.
 */
export function generateRecentEventRemovedPrompt(testCase: TestCase): string {
  let prompt = testCase.prompt;

  // Remove recent event mentions
  const recentEventPatterns = [
    /(?:a |the )?(?:recent|latest) (?:news|incident|event|crash|attack)[^.]*\.\s*/gi,
    /(?:recently|just|this week|this month|last month)[^.]*(?:happened|occurred|reported)[^.]*\.\s*/gi,
    /(?:headlines|news coverage|media attention)[^.]*\.\s*/gi,
    /(?:viral|trending|breaking news)[^.]*\.\s*/gi,
    /(?:you may have (?:seen|heard|read))[^.]*\.\s*/gi,
  ];

  for (const pattern of recentEventPatterns) {
    prompt = prompt.replace(pattern, '');
  }

  // Clean up
  prompt = prompt.replace(/\s+/g, ' ').trim();

  return prompt;
}

/**
 * Generate version with vivid details emphasized.
 */
export function generateVividnessEmphasizedPrompt(testCase: TestCase): string {
  let prompt = testCase.prompt;

  // Add vivid emphasis
  const vividAdditions = [
    {
      pattern: /(?:crash|accident)/gi,
      replacement: 'horrific crash (with dramatic footage widely shared)',
    },
    {
      pattern: /(?:attack|incident)/gi,
      replacement: 'terrifying attack (covered extensively in the media)',
    },
    {
      pattern: /(?:failure|breach)/gi,
      replacement: 'catastrophic failure (making headlines everywhere)',
    },
  ];

  for (const { pattern, replacement } of vividAdditions) {
    prompt = prompt.replace(pattern, replacement);
  }

  return prompt;
}

/**
 * Generate statistics-only version.
 * Removes all anecdotal/vivid elements, keeps only data.
 */
export function generateStatisticsOnlyPrompt(testCase: TestCase): string {
  let prompt = testCase.prompt;

  // Remove narrative elements, keep statistics
  const narrativePatterns = [
    /(?:dramatic|shocking|viral|trending|horrifying|terrifying)[^.]*\./gi,
    /(?:you (?:may have|might have|probably) (?:seen|heard|read))[^.]*\./gi,
    /(?:in the news|headlines|media coverage|extensively covered)[^.]*\./gi,
  ];

  for (const pattern of narrativePatterns) {
    prompt = prompt.replace(pattern, '');
  }

  // Ensure statistics section is prominent
  if (!prompt.includes('statistics') && !prompt.includes('data')) {
    prompt = 'Based purely on statistical data: ' + prompt;
  }

  return prompt.replace(/\s+/g, ' ').trim();
}

/**
 * Templates for varying availability cues.
 */
export const AVAILABILITY_TEMPLATES = {
  vividRecent: 'After the recent {{EVENT}} that was all over the news, ',
  vividHistorical: 'Remember the {{EVENT}} from a few years ago? ',
  statisticalOnly: 'According to statistical data, ',
  anecdotal: 'A friend of mine experienced {{EVENT}}, and ',
  mediaHeavy: 'With constant media coverage of {{EVENT}}, ',
  noContext: '', // No availability cue
};

/**
 * Generate base-rate primed version.
 */
export function generateBaseRatePrimedPrompt(testCase: TestCase): string {
  return 'Before answering, consider the statistical base rates. ' +
    'Remember that memorable events are not necessarily common events. ' +
    testCase.prompt;
}

/**
 * Generate availability-primed version.
 */
export function generateAvailabilityPrimedPrompt(testCase: TestCase): string {
  return 'Think about examples you can easily recall. ' +
    'What comes to mind when you think about this topic? ' +
    testCase.prompt;
}

export default {
  generatePromptVariation,
  generateAllVariations,
  generateRecentEventRemovedPrompt,
  generateVividnessEmphasizedPrompt,
  generateStatisticsOnlyPrompt,
  generateBaseRatePrimedPrompt,
  generateAvailabilityPrimedPrompt,
  INTRO_VARIATIONS,
  RECENCY_EMPHASIS,
  VIVIDNESS_FRAMES,
  QUESTION_FRAMES,
  CLOSING_VARIATIONS,
  AVAILABILITY_TEMPLATES,
};
