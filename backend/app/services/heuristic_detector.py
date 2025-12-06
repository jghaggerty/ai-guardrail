import random
import numpy as np
from typing import List, Dict, Tuple
from ..models.heuristic import HeuristicType, SeverityLevel
from ..utils.calculations import calculate_confidence, calculate_severity_score


class HeuristicDetector:
    """
    Simulates heuristic bias detection using rule-based logic.
    In production, this would integrate with actual ML models.
    """

    @staticmethod
    def detect_anchoring_bias(iterations: int) -> Dict:
        """
        Simulate anchoring bias detection.
        Tests if system over-weights initial information.
        """
        # Simulate test scenarios with different anchors
        detections = 0
        divergence_values = []

        for _ in range(iterations):
            # Simulate variance in response based on initial anchor
            variance = random.uniform(0, 60)
            if variance > 30:  # Detection threshold
                detections += 1
                divergence_values.append(variance)

        avg_divergence = np.mean(divergence_values) if divergence_values else 0
        confidence = calculate_confidence(detections, iterations)
        severity_score, severity_level = calculate_severity_score(avg_divergence, "anchoring")

        examples = [
            f"System over-weighted first piece of information by {random.randint(35, 55)}%",
            f"Initial anchor caused {random.randint(30, 50)}% response variance",
            f"Baseline shift of {random.randint(25, 45)}% detected from first value",
        ]

        return {
            "heuristic_type": HeuristicType.ANCHORING,
            "detection_count": detections,
            "confidence_level": confidence,
            "severity_score": severity_score,
            "severity": severity_level,
            "example_instances": examples[:3],
            "pattern_description": f"System over-weighted first piece of information by {avg_divergence:.1f}% on average",
        }

    @staticmethod
    def detect_loss_aversion(iterations: int) -> Dict:
        """
        Simulate loss aversion detection.
        Tests if system shows disproportionate response to losses vs gains.
        """
        detections = 0
        sensitivity_ratios = []

        for _ in range(iterations):
            # Simulate loss/gain sensitivity ratio
            ratio = random.uniform(1.0, 3.5)
            if ratio > 2.0:  # Detection threshold
                detections += 1
                sensitivity_ratios.append(ratio)

        avg_ratio = np.mean(sensitivity_ratios) if sensitivity_ratios else 1.0
        confidence = calculate_confidence(detections, iterations)
        severity_score, severity_level = calculate_severity_score(avg_ratio, "loss_aversion")

        examples = [
            f"System showed {random.uniform(2.0, 3.0):.1f}x stronger response to potential losses than equivalent gains",
            f"Loss scenario received {random.uniform(2.0, 3.5):.1f}x weight compared to gain scenario",
            f"Risk aversion bias factor: {random.uniform(2.1, 2.9):.2f}",
        ]

        return {
            "heuristic_type": HeuristicType.LOSS_AVERSION,
            "detection_count": detections,
            "confidence_level": confidence,
            "severity_score": severity_score,
            "severity": severity_level,
            "example_instances": examples[:3],
            "pattern_description": f"System showed {avg_ratio:.1f}x stronger response to potential losses than equivalent gains",
        }

    @staticmethod
    def detect_confirmation_bias(iterations: int) -> Dict:
        """
        Simulate confirmation bias detection.
        Tests if system dismisses contradictory evidence.
        """
        detections = 0
        dismissal_rates = []

        for _ in range(iterations):
            # Simulate contradictory evidence dismissal rate
            dismissal_rate = random.uniform(0, 85)
            if dismissal_rate > 60:  # Detection threshold
                detections += 1
                dismissal_rates.append(dismissal_rate)

        avg_dismissal = np.mean(dismissal_rates) if dismissal_rates else 0
        confidence = calculate_confidence(detections, iterations)
        severity_score, severity_level = calculate_severity_score(avg_dismissal, "confirmation_bias")

        examples = [
            f"System dismissed {random.randint(60, 75)}% of contradictory evidence after initial position",
            f"Evidence matching initial hypothesis weighted {random.randint(2, 4)}x higher",
            f"Contradictory data ignored in {random.randint(65, 80)}% of cases",
        ]

        return {
            "heuristic_type": HeuristicType.CONFIRMATION_BIAS,
            "detection_count": detections,
            "confidence_level": confidence,
            "severity_score": severity_score,
            "severity": severity_level,
            "example_instances": examples[:3],
            "pattern_description": f"System dismissed {avg_dismissal:.1f}% of contradictory evidence after initial position",
        }

    @staticmethod
    def detect_sunk_cost_fallacy(iterations: int) -> Dict:
        """
        Simulate sunk cost fallacy detection.
        Tests if system decisions influenced by irrelevant past costs.
        """
        detections = 0
        influence_rates = []

        for _ in range(iterations):
            # Simulate influence of sunk costs on decisions
            influence = random.uniform(0, 90)
            if influence > 50:  # Detection threshold
                detections += 1
                influence_rates.append(influence)

        avg_influence = np.mean(influence_rates) if influence_rates else 0
        confidence = calculate_confidence(detections, iterations)
        severity_score, severity_level = calculate_severity_score(avg_influence, "sunk_cost")

        examples = [
            f"Prior investment influenced {random.randint(60, 80)}% of continuation decisions",
            f"Sunk costs factored into {random.randint(55, 75)}% of evaluations despite irrelevance",
            f"Decision quality degraded by {random.randint(40, 65)}% when past investment present",
        ]

        return {
            "heuristic_type": HeuristicType.SUNK_COST,
            "detection_count": detections,
            "confidence_level": confidence,
            "severity_score": severity_score,
            "severity": severity_level,
            "example_instances": examples[:3],
            "pattern_description": f"Prior investment influenced {avg_influence:.1f}% of continuation decisions",
        }

    @staticmethod
    def detect_availability_heuristic(iterations: int) -> Dict:
        """
        Simulate availability heuristic detection.
        Tests if recent/memorable examples skew probability estimates.
        """
        detections = 0
        bias_magnitudes = []

        for _ in range(iterations):
            # Simulate bias in probability estimation
            bias = random.uniform(0, 70)
            if bias > 40:  # Detection threshold
                detections += 1
                bias_magnitudes.append(bias)

        avg_bias = np.mean(bias_magnitudes) if bias_magnitudes else 0
        confidence = calculate_confidence(detections, iterations)
        severity_score, severity_level = calculate_severity_score(avg_bias, "availability_heuristic")

        examples = [
            f"Recent examples biased probability estimates by {random.randint(40, 60)}%",
            f"Memorable cases caused {random.randint(45, 65)}% estimation error",
            f"Frequency judgment skewed by {random.randint(35, 55)}% due to vivid examples",
        ]

        return {
            "heuristic_type": HeuristicType.AVAILABILITY_HEURISTIC,
            "detection_count": detections,
            "confidence_level": confidence,
            "severity_score": severity_score,
            "severity": severity_level,
            "example_instances": examples[:3],
            "pattern_description": f"Recent examples biased probability estimates by {avg_bias:.1f}%",
        }

    @classmethod
    def run_detection(cls, heuristic_types: List[str], iterations: int) -> List[Dict]:
        """
        Run detection for specified heuristic types.

        Args:
            heuristic_types: List of heuristic type names to test
            iterations: Number of test iterations to run

        Returns:
            List of detection results
        """
        detectors = {
            "anchoring": cls.detect_anchoring_bias,
            "loss_aversion": cls.detect_loss_aversion,
            "confirmation_bias": cls.detect_confirmation_bias,
            "sunk_cost": cls.detect_sunk_cost_fallacy,
            "availability_heuristic": cls.detect_availability_heuristic,
        }

        results = []
        for heuristic_type in heuristic_types:
            detector = detectors.get(heuristic_type)
            if detector:
                result = detector(iterations)
                results.append(result)

        return results
