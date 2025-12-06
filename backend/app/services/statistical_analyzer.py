import random
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from ..models.evaluation import ZoneStatus
from ..utils.calculations import calculate_zone_status


class StatisticalAnalyzer:
    """
    Provides statistical analysis and longitudinal tracking capabilities.
    """

    @staticmethod
    def generate_historical_trend(
        current_score: float,
        days: int = 30,
        baseline: Dict[str, float] = None
    ) -> List[Dict]:
        """
        Generate simulated historical trend data for longitudinal tracking.

        Args:
            current_score: Current evaluation score
            days: Number of days of historical data to generate
            baseline: Baseline thresholds for zone calculation

        Returns:
            List of data points with timestamp, score, and zone
        """
        if baseline is None:
            baseline = {
                "green_zone_max": 75.0,
                "yellow_zone_max": 85.0,
            }

        data_points = []
        end_date = datetime.utcnow()

        # Generate trend from green to current zone
        for i in range(days, 0, -1):
            # Calculate score with gradual trend toward current score
            progress = (days - i) / days
            # Start in green zone and trend toward current score
            base_score = 70.0
            score_delta = current_score - base_score
            score = base_score + (score_delta * progress)

            # Add some random variance
            score += random.uniform(-3, 3)
            score = max(0, min(100, score))

            # Calculate zone status
            zone = calculate_zone_status(score, baseline)

            timestamp = end_date - timedelta(days=i)

            data_points.append({
                "timestamp": timestamp,
                "score": round(score, 2),
                "zone": zone,
            })

        return data_points

    @staticmethod
    def detect_drift(trend_data: List[Dict]) -> Tuple[bool, str]:
        """
        Detect if there's a concerning drift in the trend.

        Args:
            trend_data: List of historical data points

        Returns:
            Tuple of (has_drift: bool, drift_message: str)
        """
        if len(trend_data) < 7:
            return False, None

        # Analyze last 7 days vs previous period
        recent = [point["score"] for point in trend_data[-7:]]
        previous = [point["score"] for point in trend_data[-14:-7]] if len(trend_data) >= 14 else []

        if not previous:
            return False, None

        recent_avg = sum(recent) / len(recent)
        previous_avg = sum(previous) / len(previous)

        drift_percent = ((recent_avg - previous_avg) / previous_avg) * 100

        if abs(drift_percent) > 10:
            direction = "increasing" if drift_percent > 0 else "decreasing"
            return True, f"Bias metrics {direction} by {abs(drift_percent):.1f}% over last 7 days"

        return False, None

    @staticmethod
    def calculate_overall_score(findings: List[Dict]) -> float:
        """
        Calculate overall evaluation score from heuristic findings.
        Lower scores are better (less bias).

        Args:
            findings: List of heuristic finding dictionaries

        Returns:
            Overall score (0-100)
        """
        if not findings:
            return 0.0

        # Weight by confidence and severity
        weighted_sum = 0
        total_weight = 0

        for finding in findings:
            confidence = finding.get("confidence_level", 0)
            severity_score = finding.get("severity_score", 0)

            weight = confidence
            weighted_sum += severity_score * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        overall = weighted_sum / total_weight
        return round(overall, 2)

    @staticmethod
    def get_default_baseline() -> Dict[str, float]:
        """
        Get default baseline parameters.

        Returns:
            Default baseline dictionary
        """
        return {
            "mean": 75.0,
            "std_dev": 10.0,
            "green_zone_max": 80.0,
            "yellow_zone_max": 90.0,
            "sample_size": 0,
        }
