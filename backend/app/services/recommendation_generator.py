from typing import List, Dict
from ..models.recommendation import ImpactLevel, DifficultyLevel
from ..utils.calculations import calculate_priority


class RecommendationGenerator:
    """
    Generates actionable recommendations based on detected heuristic biases.
    """

    # Pre-defined recommendation templates mapped to heuristic types
    RECOMMENDATION_TEMPLATES = {
        "anchoring": [
            {
                "action_title": "Implement multi-perspective prompting",
                "technical_description": "Restructure prompts to present multiple baseline values before eliciting response. Use randomized anchor values across test scenarios to reduce single-anchor dependency.",
                "simplified_description": "Present multiple starting points to prevent over-reliance on first value shown",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.EASY,
            },
            {
                "action_title": "Add anchor-blind evaluation phase",
                "technical_description": "Implement two-stage evaluation: initial assessment without context, followed by contextualized refinement. Compare outputs to measure anchor influence.",
                "simplified_description": "Make initial decisions without reference points, then add context separately",
                "estimated_impact": ImpactLevel.MEDIUM,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
            {
                "action_title": "Randomize information presentation order",
                "technical_description": "Dynamically shuffle the order in which data points are presented to the model. Track variance across different orderings to identify order-dependency.",
                "simplified_description": "Change the order information is shown to reduce first-impression bias",
                "estimated_impact": ImpactLevel.MEDIUM,
                "implementation_difficulty": DifficultyLevel.EASY,
            },
        ],
        "loss_aversion": [
            {
                "action_title": "Normalize gain/loss framing",
                "technical_description": "Present scenarios in both gain-framed and loss-framed versions. Calibrate model weights to ensure equivalent scenarios receive equivalent treatment regardless of framing.",
                "simplified_description": "Ensure positive and negative outcomes are weighted equally",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
            {
                "action_title": "Implement risk-neutral scoring",
                "technical_description": "Apply risk-neutral transformation to model outputs. Use expected value calculations rather than prospect-theory based evaluations.",
                "simplified_description": "Focus on actual probability and impact rather than emotional response to risk",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.COMPLEX,
            },
            {
                "action_title": "Add loss aversion detection layer",
                "technical_description": "Monitor model outputs for asymmetric gain/loss responses. Flag and reprocess decisions showing >1.5x sensitivity differential.",
                "simplified_description": "Automatically detect and correct when system over-reacts to potential losses",
                "estimated_impact": ImpactLevel.MEDIUM,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
        ],
        "confirmation_bias": [
            {
                "action_title": "Implement adversarial evidence search",
                "technical_description": "For each hypothesis, automatically generate and evaluate counter-arguments. Require model to engage with strongest contradictory evidence before finalizing position.",
                "simplified_description": "Actively search for and consider evidence that contradicts initial thinking",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
            {
                "action_title": "Add belief revision tracking",
                "technical_description": "Monitor whether and how the model updates beliefs when presented with contradictory evidence. Score based on Bayesian updating rather than position consistency.",
                "simplified_description": "Track and reward changing opinions when new evidence appears",
                "estimated_impact": ImpactLevel.MEDIUM,
                "implementation_difficulty": DifficultyLevel.COMPLEX,
            },
            {
                "action_title": "Use blind evidence evaluation",
                "technical_description": "Present evidence without labels indicating whether it supports or contradicts current hypothesis. Measure evidence weight assignment before revealing relevance.",
                "simplified_description": "Evaluate evidence quality before knowing if it supports current position",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
        ],
        "sunk_cost": [
            {
                "action_title": "Implement forward-looking decision framework",
                "technical_description": "Structure prompts to focus exclusively on future costs and benefits. Explicitly exclude historical investment data from decision-relevant context.",
                "simplified_description": "Make decisions based only on future outcomes, ignoring past investments",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.EASY,
            },
            {
                "action_title": "Add sunk cost filter",
                "technical_description": "Detect when historical cost information appears in reasoning chain. Automatically strip or flag sunk cost references before final decision.",
                "simplified_description": "Remove information about past investments from decision-making process",
                "estimated_impact": ImpactLevel.MEDIUM,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
            {
                "action_title": "Use incremental value analysis",
                "technical_description": "Evaluate each decision as if starting fresh. Compare 'continue current path' vs 'switch to alternative' using only prospective analysis.",
                "simplified_description": "Evaluate each choice as if it's the first decision being made",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
        ],
        "availability_heuristic": [
            {
                "action_title": "Incorporate base rate priming",
                "technical_description": "Explicitly provide statistical base rates and frequency data before eliciting probability judgments. Weight base rates higher than anecdotal examples.",
                "simplified_description": "Start with actual statistics before considering individual examples",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.EASY,
            },
            {
                "action_title": "Implement recency weighting correction",
                "technical_description": "Apply inverse recency weights to training data and examples. Normalize for vividness and memorability to prevent availability bias.",
                "simplified_description": "Reduce influence of recent or memorable events in predictions",
                "estimated_impact": ImpactLevel.MEDIUM,
                "implementation_difficulty": DifficultyLevel.COMPLEX,
            },
            {
                "action_title": "Use frequency-based sampling",
                "technical_description": "When retrieving examples, sample proportionally to true frequency rather than availability. Implement representative sampling over convenient sampling.",
                "simplified_description": "Choose examples based on how common they actually are, not how easy to recall",
                "estimated_impact": ImpactLevel.HIGH,
                "implementation_difficulty": DifficultyLevel.MODERATE,
            },
        ],
    }

    @classmethod
    def generate_recommendations(
        cls,
        findings: List[Dict],
        mode: str = "technical"
    ) -> List[Dict]:
        """
        Generate prioritized recommendations based on heuristic findings.

        Args:
            findings: List of heuristic finding dictionaries
            mode: Output mode ('technical' or 'simplified')

        Returns:
            List of recommendation dictionaries, sorted by priority
        """
        recommendations = []

        for finding in findings:
            heuristic_type = finding.get("heuristic_type")
            if isinstance(heuristic_type, object):
                # Convert enum to string
                heuristic_type = heuristic_type.value

            templates = cls.RECOMMENDATION_TEMPLATES.get(heuristic_type, [])

            severity_score = finding.get("severity_score", 0)
            confidence = finding.get("confidence_level", 0)

            # Generate recommendations for this heuristic type
            for template in templates:
                impact = template["estimated_impact"].value
                priority = calculate_priority(severity_score, confidence, impact)

                recommendation = {
                    "heuristic_type": heuristic_type,
                    "priority": priority,
                    "action_title": template["action_title"],
                    "technical_description": template["technical_description"],
                    "simplified_description": template["simplified_description"],
                    "estimated_impact": template["estimated_impact"],
                    "implementation_difficulty": template["implementation_difficulty"],
                }

                recommendations.append(recommendation)

        # Sort by priority (descending)
        recommendations.sort(key=lambda x: x["priority"], reverse=True)

        # Return top 7 recommendations
        return recommendations[:7]
