import numpy as np
from typing import List, Tuple, Dict
from ..models.heuristic import SeverityLevel
from ..models.evaluation import ZoneStatus


def calculate_baseline(historical_scores: List[float]) -> Dict[str, float]:
    """
    Calculate statistical baseline and zone thresholds.

    Args:
        historical_scores: List of historical evaluation scores

    Returns:
        Dictionary with mean, std_dev, green_zone_max, yellow_zone_max
    """
    if not historical_scores:
        # Default baseline if no history
        return {
            "mean": 75.0,
            "std_dev": 10.0,
            "green_zone_max": 80.0,
            "yellow_zone_max": 90.0,
            "sample_size": 0,
        }

    mean = float(np.mean(historical_scores))
    std_dev = float(np.std(historical_scores))
    green_zone_max = mean + (0.5 * std_dev)
    yellow_zone_max = mean + (1.5 * std_dev)

    return {
        "mean": mean,
        "std_dev": std_dev,
        "green_zone_max": green_zone_max,
        "yellow_zone_max": yellow_zone_max,
        "sample_size": len(historical_scores),
    }


def calculate_confidence(detection_count: int, total_iterations: int) -> float:
    """
    Calculate confidence level based on detection rate and sample size.

    Args:
        detection_count: Number of times bias was detected
        total_iterations: Total number of test iterations

    Returns:
        Confidence level (0-1), capped at 0.99
    """
    if total_iterations == 0:
        return 0.0

    proportion = detection_count / total_iterations
    confidence = proportion * (1 - (1 / np.sqrt(total_iterations)))
    return min(confidence, 0.99)


def calculate_severity_score(raw_metric: float, heuristic_type: str) -> Tuple[float, SeverityLevel]:
    """
    Calculate severity score and level based on heuristic-specific thresholds.

    Args:
        raw_metric: Raw metric value from heuristic detection
        heuristic_type: Type of heuristic bias

    Returns:
        Tuple of (severity_score: 0-100, severity_level)
    """
    # Thresholds for different heuristic types
    thresholds = {
        "anchoring": {
            "critical": 50,
            "high": 40,
            "medium": 20,
            "low": 10,
        },
        "loss_aversion": {
            "critical": 3.0,
            "high": 2.5,
            "medium": 1.8,
            "low": 1.3,
        },
        "sunk_cost": {
            "critical": 80,
            "high": 70,
            "medium": 50,
            "low": 30,
        },
        "confirmation_bias": {
            "critical": 75,
            "high": 65,
            "medium": 50,
            "low": 35,
        },
        "availability_heuristic": {
            "critical": 60,
            "high": 50,
            "medium": 35,
            "low": 20,
        },
    }

    heuristic_thresholds = thresholds.get(heuristic_type, thresholds["anchoring"])

    # Determine severity level
    if raw_metric >= heuristic_thresholds["critical"]:
        severity_level = SeverityLevel.CRITICAL
        # Map to 75-100 range
        score = 75 + (raw_metric - heuristic_thresholds["critical"]) / 2
    elif raw_metric >= heuristic_thresholds["high"]:
        severity_level = SeverityLevel.HIGH
        # Map to 50-75 range
        score = 50 + ((raw_metric - heuristic_thresholds["high"]) /
                     (heuristic_thresholds["critical"] - heuristic_thresholds["high"]) * 25)
    elif raw_metric >= heuristic_thresholds["medium"]:
        severity_level = SeverityLevel.MEDIUM
        # Map to 25-50 range
        score = 25 + ((raw_metric - heuristic_thresholds["medium"]) /
                     (heuristic_thresholds["high"] - heuristic_thresholds["medium"]) * 25)
    else:
        severity_level = SeverityLevel.LOW
        # Map to 0-25 range
        score = (raw_metric / heuristic_thresholds["medium"]) * 25

    return min(score, 100.0), severity_level


def calculate_zone_status(score: float, baseline: Dict[str, float]) -> ZoneStatus:
    """
    Determine zone status based on score and baseline thresholds.

    Args:
        score: Evaluation score
        baseline: Baseline dictionary with zone thresholds

    Returns:
        ZoneStatus (green, yellow, or red)
    """
    if score <= baseline["green_zone_max"]:
        return ZoneStatus.GREEN
    elif score <= baseline["yellow_zone_max"]:
        return ZoneStatus.YELLOW
    else:
        return ZoneStatus.RED


def calculate_priority(severity_score: float, confidence_level: float, impact: str) -> int:
    """
    Calculate recommendation priority (1-10).

    Args:
        severity_score: Severity score (0-100)
        confidence_level: Confidence level (0-1)
        impact: Impact level (low, medium, high)

    Returns:
        Priority score (1-10)
    """
    impact_scores = {"low": 5, "medium": 10, "high": 15}
    impact_score = impact_scores.get(impact, 10)

    priority = (severity_score * 0.6) + (confidence_level * 30) + (impact_score * 0.1)

    # Normalize to 1-10 scale
    normalized = int((priority / 100) * 9) + 1
    return min(max(normalized, 1), 10)
