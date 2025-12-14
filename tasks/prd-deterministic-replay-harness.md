# PRD: Deterministic Replay Harness

## Introduction/Overview

This feature enables deterministic or near-deterministic evaluation runs by controlling randomness through fixed seeds, temperature bounds, and fixed decoding parameters. For supported model hosts, evaluations can be run with fixed parameters to produce reproducible results, or with multiple iterations to generate statistically stable confidence intervals. This addresses compliance needs for reproducible evaluations and reduces concerns about stochastic variability.

**Problem:** LLM evaluations are inherently non-deterministic due to randomness in generation, making it difficult to reproduce results and verify findings. Compliance teams need reproducible evaluations and statistical confidence that results aren't just random noise.

**Goal:** Provide a deterministic replay harness that enables reproducible evaluations and generates confidence intervals for non-deterministic scenarios, supporting all major model providers in BiasLens.

## Goals

1. Enable deterministic evaluation runs for supported model providers using fixed seeds and temperature parameters
2. Support near-deterministic runs with statistical confidence intervals when full determinism isn't possible
3. Provide global configuration setting for deterministic mode across all evaluations
4. Generate confidence intervals automatically for non-deterministic runs
5. Support adaptive iteration counting that runs until confidence intervals stabilize
6. Work with all major model providers: OpenAI, Anthropic, Google, Meta (Llama), DeepSeek, Azure, AWS Bedrock, and Custom endpoints

## User Stories

1. **As a compliance officer**, I want to run the same evaluation twice and get the same results so that I can verify findings and demonstrate reproducibility to auditors.

2. **As a data scientist**, I want confidence intervals on evaluation results so that I can distinguish real bias patterns from random variation.

3. **As a QA engineer**, I want to enable deterministic mode globally so that all my evaluations are reproducible for regression testing.

4. **As a compliance auditor**, I want to see that evaluations produce statistically stable results so that I can trust the findings aren't just noise.

5. **As a DevOps engineer**, I want the system to automatically determine when enough iterations have been run so that I get reliable results without manual tuning.

## Functional Requirements

1. The system must provide a global setting in Settings page to enable/disable deterministic replay mode for all evaluations.

2. When deterministic mode is enabled, the system must:
   - Use fixed seed values for model generation (when supported by provider)
   - Set temperature to 0 or minimum supported value for maximum determinism
   - Use fixed decoding parameters (top_p, top_k, etc.) when applicable
   - Document which parameters were fixed in evaluation metadata

3. The system must support deterministic mode for the following providers (based on current BiasLens support):
   - **OpenAI**: gpt-5, gpt-4.5-preview, gpt-4o, gpt-4-turbo, gpt-4, gpt-3.5-turbo
   - **Anthropic**: claude-opus-4-5-20251101, claude-sonnet-4-20250514, claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229
   - **Google**: gemini-2.5-pro, gemini-2.5-flash, gemini-1.5-pro, gemini-1.5-flash, gemini-pro
   - **Meta**: llama-4-scout, llama-4-maverick, llama-3.1-405b, llama-3.1-70b, llama-3.1-8b
   - **DeepSeek**: deepseek-v3, deepseek-r1, deepseek-coder
   - **Azure**: gpt-4, gpt-4-turbo, gpt-35-turbo (OpenAI-compatible)
   - **AWS Bedrock**: anthropic.claude-3, amazon.titan, meta.llama3
   - **Custom**: Any OpenAI-compatible endpoint

4. The system must detect provider support for determinism:
   - Check if provider API supports seed parameter
   - Check if provider API supports temperature=0
   - Fall back to near-deterministic mode if full determinism isn't supported
   - Log determinism level achieved for each evaluation

5. When full determinism isn't available, the system must support near-deterministic mode:
   - Run multiple iterations of the same evaluation
   - Calculate statistical confidence intervals for scores
   - Use temperature bounds (e.g., temperature ≤ 0.1) instead of temperature=0
   - Document that results are statistically similar, not identical

6. The system must automatically calculate confidence intervals for non-deterministic runs:
   - Compute mean, standard deviation, and confidence intervals (e.g., 95% CI)
   - Display confidence intervals in evaluation results UI
   - Include confidence interval data in evaluation metadata

7. The system must support adaptive iteration counting:
   - Start with a minimum number of iterations (e.g., 5)
   - Continue running iterations until confidence interval stabilizes (coefficient of variation below threshold)
   - Set maximum iteration limit to prevent infinite loops (e.g., 50 iterations)
   - Allow user to configure minimum/maximum iterations and stability threshold

8. The system must store determinism configuration with each evaluation:
   - Determinism mode used (full, near-deterministic, or disabled)
   - Seed value used (if applicable)
   - Temperature and other parameters used
   - Number of iterations run (for near-deterministic mode)
   - Confidence interval data

9. The system must display determinism information in evaluation results:
   - Indicator showing determinism mode (full/near/disabled)
   - Seed value used (if applicable)
   - Confidence intervals for scores (when applicable)
   - Number of iterations (for near-deterministic runs)

10. The system must handle API rate limits gracefully:
    - Implement backoff and retry logic for rate-limited requests
    - Queue iterations if needed to respect rate limits
    - Provide progress indicators for long-running deterministic evaluations

11. The system must support deterministic mode for all evaluation types:
    - Single evaluations
    - Scheduled/recurring evaluations
    - Batch evaluations

12. The system must provide clear error messages when determinism isn't supported:
    - Inform user if provider/model doesn't support deterministic parameters
    - Suggest alternative (near-deterministic mode with confidence intervals)
    - Allow evaluation to proceed in non-deterministic mode if user chooses

## Non-Goals (Out of Scope)

1. This feature will NOT guarantee full determinism for providers/APIs that don't support it - it will use best-effort near-determinism instead.

2. This feature will NOT provide per-evaluation or per-test-case determinism configuration in the initial version - it's a global setting only.

3. This feature will NOT modify the actual model behavior or training - it only controls evaluation parameters.

4. This feature will NOT provide deterministic replay of historical evaluations that were run without deterministic mode.

5. This feature will NOT support custom statistical methods beyond standard confidence intervals in the initial version.

6. This feature will NOT automatically adjust real-world model parameters - deterministic mode is for testing/evaluation only.

## Design Considerations

1. **Settings UI:**
   - New section: "Deterministic Replay"
   - Toggle switch: "Enable Deterministic Mode" (global setting)
   - When enabled, show configuration options:
     - "Determinism Level" dropdown: "Full Determinism" or "Near-Deterministic with Confidence Intervals"
     - "Adaptive Iterations" toggle (on/off)
     - If adaptive off: "Fixed Iterations" number input
     - "Minimum Iterations" (for adaptive mode)
     - "Maximum Iterations" (for adaptive mode)
     - "Stability Threshold" (coefficient of variation, e.g., 0.05 for 5%)
   - Display current status: "Deterministic mode enabled/disabled"
   - Warning message if current provider doesn't support full determinism

2. **Evaluation Results UI:**
   - Badge/indicator showing determinism status: "Deterministic", "Near-Deterministic", or "Non-Deterministic"
   - Display seed value if used
   - Show confidence intervals as error bars or ranges on scores
   - Display iteration count for near-deterministic runs
   - Tooltip explaining what determinism level means

3. **Evaluation Execution:**
   - Progress indicator showing iteration progress for near-deterministic runs
   - Estimated time remaining based on iteration count
   - Ability to cancel long-running deterministic evaluations

4. **Error Handling:**
   - Clear messages when provider doesn't support determinism
   - Fallback options presented to user
   - Graceful degradation to non-deterministic mode if needed

## Technical Considerations

1. **Provider API Support:**
   - **OpenAI**: Supports `seed` parameter and `temperature=0` for determinism
   - **Anthropic**: Supports `temperature=0` but may not support seed (check API docs)
   - **Google**: Supports `temperature=0` and potentially seed (verify Gemini API)
   - **Meta/Azure/AWS Bedrock**: Varies by model - need to check each provider's API
   - **Custom**: Depends on endpoint - assume OpenAI-compatible format

2. **Implementation Approach:**
   - Extend existing LLM client interfaces in `supabase/functions/evaluate/llm-clients/`
   - Add determinism parameters to `LLMOptions` interface
   - Modify each provider client to respect determinism settings
   - Add iteration loop for near-deterministic mode

3. **Statistical Calculations:**
   - Implement confidence interval calculation (t-distribution for small samples)
   - Calculate coefficient of variation for stability detection
   - Store statistical metadata in evaluation results

4. **Database Schema:**
   - Add columns to evaluation results table:
     - `determinism_mode` (enum: full, near, disabled)
     - `seed_value` (nullable integer)
     - `iterations_run` (integer, for near-deterministic)
     - `confidence_intervals` (JSONB with CI data per score)
   - Store per-iteration results for statistical analysis

5. **Performance:**
   - Near-deterministic mode will increase evaluation time (multiple iterations)
   - Consider parallel iteration execution where possible (respecting rate limits)
   - Cache intermediate results to avoid recomputation

6. **Rate Limiting:**
   - Implement intelligent rate limit handling for multiple iterations
   - Queue iterations if needed
   - Provide progress updates during long-running evaluations

7. **Integration:**
   - Must work with customer-side evidence capture (store seed/iterations in evidence)
   - Must work with repro packs (include determinism config in repro pack)
   - Must integrate with existing evaluation execution flow

8. **Dependencies:**
   - Statistical libraries for confidence interval calculation (or implement standard formulas)
   - Existing LLM client implementations
   - Evaluation framework

## Success Metrics

1. **Adoption:** Number of customers enabling deterministic mode within first 3 months
2. **Support Reduction:** Reduction in compliance-related support tickets about result reproducibility
3. **Audit Efficiency:** Reduction in time to complete compliance audits (measured through customer surveys)
4. **Reproducibility:** Percentage of evaluations that produce identical results when re-run with same seed (target: >95% for full determinism mode)
5. **Confidence:** Average confidence interval width (narrower = more confident, target: <10% of mean score)

## Open Questions

1. Should we support per-evaluation determinism override (even though global is the initial requirement)?
2. What is the default stability threshold for adaptive iterations? (Suggested: 5% coefficient of variation)
3. Should we provide different confidence levels (90%, 95%, 99%) or just use 95%?
4. How should we handle evaluations that never stabilize (hit maximum iterations)?
5. Should deterministic mode be enabled by default for new customers, or opt-in?
6. How do we handle model updates that might change deterministic behavior even with same seed?
7. Should we store individual iteration results for advanced analysis, or just aggregate statistics?

