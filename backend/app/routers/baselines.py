from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.baseline import Baseline
from ..models.evaluation import Evaluation
from ..schemas.baseline import BaselineCreate, BaselineResponse
from ..services.statistical_analyzer import StatisticalAnalyzer
from ..utils.error_handlers import raise_not_found
from ..auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/baselines", tags=["baselines"])


@router.post("", response_model=BaselineResponse, status_code=201)
def create_baseline(
    baseline: BaselineCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create or update a statistical baseline.
    """
    # If evaluation_id provided, use its score in baseline calculation
    historical_scores = []

    if baseline.evaluation_id:
        evaluation = db.query(Evaluation).filter(
            Evaluation.id == baseline.evaluation_id
        ).first()
        if evaluation and evaluation.overall_score:
            historical_scores.append(evaluation.overall_score)

    # Calculate baseline statistics
    stats = StatisticalAnalyzer.get_default_baseline()

    if historical_scores:
        # Use provided scores to calculate baseline
        from ..utils.calculations import calculate_baseline
        stats = calculate_baseline(historical_scores)

    # Override with custom thresholds if provided
    if baseline.zone_thresholds:
        if "green_zone_max" in baseline.zone_thresholds:
            stats["green_zone_max"] = baseline.zone_thresholds["green_zone_max"]
        if "yellow_zone_max" in baseline.zone_thresholds:
            stats["yellow_zone_max"] = baseline.zone_thresholds["yellow_zone_max"]

    # Create baseline
    db_baseline = Baseline(
        name=baseline.name,
        green_zone_max=stats["green_zone_max"],
        yellow_zone_max=stats["yellow_zone_max"],
        statistical_params=stats,
    )

    db.add(db_baseline)
    db.commit()
    db.refresh(db_baseline)

    return db_baseline


@router.get("/{baseline_id}", response_model=BaselineResponse)
def get_baseline(
    baseline_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve baseline configuration and statistics.
    """
    baseline = db.query(Baseline).filter(Baseline.id == baseline_id).first()

    if not baseline:
        raise_not_found("Baseline", baseline_id)

    return baseline
