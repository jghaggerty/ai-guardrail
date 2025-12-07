from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.evaluation import Evaluation
from ..schemas.trend import TrendResponse
from ..services.statistical_analyzer import StatisticalAnalyzer
from ..utils.error_handlers import raise_not_found
from ..auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/evaluations", tags=["trends"])


@router.get("/{evaluation_id}/trends", response_model=TrendResponse)
def get_trends(
    evaluation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate longitudinal trends and zone status.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    if not evaluation.overall_score:
        raise_not_found("Trends", evaluation_id)

    # Get baseline
    baseline = StatisticalAnalyzer.get_default_baseline()

    # Generate historical trend data
    trend_data = StatisticalAnalyzer.generate_historical_trend(
        current_score=evaluation.overall_score,
        days=30,
        baseline=baseline
    )

    # Detect drift
    has_drift, drift_message = StatisticalAnalyzer.detect_drift(trend_data)

    return {
        "evaluation_id": evaluation.id,
        "data_points": trend_data,
        "current_zone": evaluation.zone_status,
        "drift_alert": has_drift,
        "drift_message": drift_message,
    }
