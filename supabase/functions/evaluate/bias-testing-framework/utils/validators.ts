/**
 * Validators for Cognitive Bias Testing Framework
 *
 * Provides validation functions for test cases, configurations,
 * and results to ensure data integrity throughout the testing process.
 */

import type {
  BiasType,
  Difficulty,
  TestCase,
  TestConfiguration,
  ScoringRubric,
  TestResult,
  GeneratedPrompt,
} from '../core/types.ts';

// Valid bias types
const VALID_BIAS_TYPES: BiasType[] = [
  'anchoring',
  'loss_aversion',
  'confirmation_bias',
  'sunk_cost_fallacy',
  'availability_heuristic',
];

// Valid difficulty levels
const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Validation result with optional error messages.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Create a successful validation result.
 */
function success(warnings: string[] = []): ValidationResult {
  return { valid: true, errors: [], warnings };
}

/**
 * Create a failed validation result.
 */
function failure(errors: string[], warnings: string[] = []): ValidationResult {
  return { valid: false, errors, warnings };
}

/**
 * Validate a bias type string.
 */
export function validateBiasType(biasType: string): ValidationResult {
  if (!VALID_BIAS_TYPES.includes(biasType as BiasType)) {
    return failure([
      `Invalid bias type: "${biasType}". Valid types are: ${VALID_BIAS_TYPES.join(', ')}`,
    ]);
  }
  return success();
}

/**
 * Validate a difficulty level.
 */
export function validateDifficulty(difficulty: string): ValidationResult {
  if (!VALID_DIFFICULTIES.includes(difficulty as Difficulty)) {
    return failure([
      `Invalid difficulty: "${difficulty}". Valid levels are: ${VALID_DIFFICULTIES.join(', ')}`,
    ]);
  }
  return success();
}

/**
 * Validate a scoring rubric.
 */
export function validateScoringRubric(rubric: ScoringRubric): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check dimensions exist
  if (!rubric.dimensions || rubric.dimensions.length === 0) {
    errors.push('Scoring rubric must have at least one dimension');
  } else {
    // Validate each dimension
    for (const dim of rubric.dimensions) {
      if (!dim.name || dim.name.trim() === '') {
        errors.push('Each scoring dimension must have a name');
      }
      if (!dim.description || dim.description.trim() === '') {
        warnings.push(`Dimension "${dim.name}" should have a description`);
      }
      if (dim.maxScale < 0 || dim.maxScale > 5) {
        errors.push(`Dimension "${dim.name}" has invalid maxScale: ${dim.maxScale}. Must be 0-5`);
      }
      if (!dim.indicators || dim.indicators.length === 0) {
        warnings.push(`Dimension "${dim.name}" should have bias indicators defined`);
      }
    }
  }

  // Validate weights
  if (!rubric.weights || Object.keys(rubric.weights).length === 0) {
    errors.push('Scoring rubric must have weights defined');
  } else {
    const totalWeight = Object.values(rubric.weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      errors.push(`Weights must sum to 1.0, got ${totalWeight.toFixed(3)}`);
    }

    // Check all dimensions have weights
    if (rubric.dimensions) {
      for (const dim of rubric.dimensions) {
        if (rubric.weights[dim.name] === undefined) {
          errors.push(`Missing weight for dimension "${dim.name}"`);
        }
      }
    }
  }

  // Check interpretation guide
  if (!rubric.interpretationGuide || rubric.interpretationGuide.trim() === '') {
    warnings.push('Scoring rubric should have an interpretation guide');
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

/**
 * Validate a test case ID format.
 */
export function validateTestCaseId(id: string): ValidationResult {
  const pattern = /^[a-z_]+_\d{3}$/;
  if (!pattern.test(id)) {
    return failure([
      `Invalid test case ID format: "${id}". Expected format: biastype_XXX (e.g., anchoring_001)`,
    ]);
  }
  return success();
}

/**
 * Validate a complete test case.
 */
export function validateTestCase(testCase: TestCase): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!testCase.id) {
    errors.push('Test case must have an id');
  } else {
    const idResult = validateTestCaseId(testCase.id);
    errors.push(...idResult.errors);
  }

  if (!testCase.biasType) {
    errors.push('Test case must have a biasType');
  } else {
    const biasResult = validateBiasType(testCase.biasType);
    errors.push(...biasResult.errors);
  }

  if (!testCase.name || testCase.name.trim() === '') {
    errors.push('Test case must have a name');
  }

  if (!testCase.description || testCase.description.trim() === '') {
    warnings.push('Test case should have a description');
  }

  if (!testCase.prompt || testCase.prompt.trim() === '') {
    errors.push('Test case must have a prompt');
  }

  // Validate difficulty
  if (!testCase.difficulty) {
    errors.push('Test case must have a difficulty level');
  } else {
    const diffResult = validateDifficulty(testCase.difficulty);
    errors.push(...diffResult.errors);
  }

  // Validate expected bias indicators
  if (!testCase.expectedBiasIndicators || testCase.expectedBiasIndicators.length === 0) {
    warnings.push('Test case should have expected bias indicators defined');
  }

  // Validate scoring rubric
  if (!testCase.scoringRubric) {
    errors.push('Test case must have a scoring rubric');
  } else {
    const rubricResult = validateScoringRubric(testCase.scoringRubric);
    errors.push(...rubricResult.errors);
    warnings.push(...rubricResult.warnings);
  }

  // Check category
  if (!testCase.category || testCase.category.trim() === '') {
    warnings.push('Test case should have a category');
  }

  // Check tags
  if (!testCase.tags || testCase.tags.length === 0) {
    warnings.push('Test case should have tags for filtering');
  }

  // Check prompt variables match placeholders
  if (testCase.prompt && testCase.promptVariables) {
    const placeholders = testCase.prompt.match(/\{\{(\w+)\}\}/g) || [];
    const placeholderNames = placeholders.map((p) => p.replace(/\{\{|\}\}/g, ''));
    const variableNames = Object.keys(testCase.promptVariables);

    for (const placeholder of placeholderNames) {
      if (!variableNames.includes(placeholder)) {
        warnings.push(`Placeholder "{{${placeholder}}}" in prompt has no corresponding variable`);
      }
    }
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

/**
 * Validate test configuration.
 */
export function validateTestConfiguration(config: TestConfiguration): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate bias types
  if (!config.biasTypes || config.biasTypes.length === 0) {
    errors.push('Configuration must specify at least one bias type');
  } else {
    for (const biasType of config.biasTypes) {
      const result = validateBiasType(biasType);
      errors.push(...result.errors);
    }
  }

  // Validate test iterations
  if (config.testIterations === undefined || config.testIterations === null) {
    errors.push('Configuration must specify testIterations');
  } else if (config.testIterations < 1) {
    errors.push('testIterations must be at least 1');
  } else if (config.testIterations > 1000) {
    warnings.push('testIterations > 1000 may take a long time to execute');
  }

  // Validate difficulty
  if (!config.difficulty || config.difficulty.length === 0) {
    errors.push('Configuration must specify at least one difficulty level');
  } else {
    for (const diff of config.difficulty) {
      const result = validateDifficulty(diff);
      errors.push(...result.errors);
    }
  }

  // Validate output format
  const validFormats = ['json', 'csv', 'html'];
  if (config.outputFormat && !validFormats.includes(config.outputFormat)) {
    errors.push(`Invalid output format: "${config.outputFormat}". Valid formats: ${validFormats.join(', ')}`);
  }

  // Validate random seed
  if (config.randomSeed !== undefined && config.randomSeed < 0) {
    errors.push('randomSeed must be a non-negative number');
  }

  // Validate maxConcurrency
  if (config.maxConcurrency !== undefined) {
    if (config.maxConcurrency < 1) {
      errors.push('maxConcurrency must be at least 1');
    } else if (config.maxConcurrency > 50) {
      warnings.push('maxConcurrency > 50 may cause rate limiting with LLM providers');
    }
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

/**
 * Validate a test result.
 */
export function validateTestResult(result: TestResult): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result.testCaseId) {
    errors.push('Test result must have a testCaseId');
  }

  if (result.iterationNumber === undefined || result.iterationNumber < 1) {
    errors.push('Test result must have a valid iterationNumber (>= 1)');
  }

  if (result.overallBiasScore === undefined) {
    errors.push('Test result must have an overallBiasScore');
  } else if (result.overallBiasScore < 0 || result.overallBiasScore > 5) {
    errors.push('overallBiasScore must be between 0 and 5');
  }

  if (result.confidence === undefined) {
    errors.push('Test result must have a confidence score');
  } else if (result.confidence < 0 || result.confidence > 1) {
    errors.push('confidence must be between 0 and 1');
  }

  if (!result.timestamp) {
    errors.push('Test result must have a timestamp');
  }

  // Validate dimension scores
  if (result.biasScores) {
    for (const [dimension, score] of Object.entries(result.biasScores)) {
      if (score < 0 || score > 5) {
        errors.push(`Dimension score "${dimension}" must be between 0 and 5, got ${score}`);
      }
    }
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

/**
 * Validate a generated prompt.
 */
export function validateGeneratedPrompt(prompt: GeneratedPrompt): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!prompt.testCaseId) {
    errors.push('Generated prompt must have a testCaseId');
  }

  if (prompt.iteration === undefined || prompt.iteration < 1) {
    errors.push('Generated prompt must have a valid iteration number (>= 1)');
  }

  if (!prompt.prompt || prompt.prompt.trim() === '') {
    errors.push('Generated prompt must have non-empty prompt text');
  }

  if (!prompt.metadata) {
    errors.push('Generated prompt must have metadata');
  } else {
    if (!prompt.metadata.biasType) {
      errors.push('Prompt metadata must include biasType');
    }
    if (!prompt.metadata.difficulty) {
      errors.push('Prompt metadata must include difficulty');
    }
  }

  // Check for unresolved placeholders
  if (prompt.prompt && prompt.prompt.includes('{{')) {
    warnings.push('Prompt may contain unresolved template placeholders');
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

/**
 * Validate an array of test cases for consistency.
 */
export function validateTestCaseCollection(testCases: TestCase[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (testCases.length === 0) {
    errors.push('Test case collection is empty');
    return failure(errors);
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  for (const tc of testCases) {
    if (ids.has(tc.id)) {
      errors.push(`Duplicate test case ID: "${tc.id}"`);
    }
    ids.add(tc.id);
  }

  // Validate each test case
  for (const tc of testCases) {
    const result = validateTestCase(tc);
    if (!result.valid) {
      errors.push(`Test case "${tc.id}": ${result.errors.join('; ')}`);
    }
    warnings.push(...result.warnings.map((w) => `Test case "${tc.id}": ${w}`));
  }

  // Check for balanced coverage
  const biasTypeCounts: Record<string, number> = {};
  for (const tc of testCases) {
    biasTypeCounts[tc.biasType] = (biasTypeCounts[tc.biasType] || 0) + 1;
  }

  const counts = Object.values(biasTypeCounts);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  if (maxCount > minCount * 2) {
    warnings.push(
      `Unbalanced test case distribution across bias types: ${JSON.stringify(biasTypeCounts)}`
    );
  }

  return errors.length > 0 ? failure(errors, warnings) : success(warnings);
}

export default {
  validateBiasType,
  validateDifficulty,
  validateScoringRubric,
  validateTestCaseId,
  validateTestCase,
  validateTestConfiguration,
  validateTestResult,
  validateGeneratedPrompt,
  validateTestCaseCollection,
};
