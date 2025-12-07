from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.evaluation import Evaluation
from ..models.recommendation import Recommendation
from ..schemas.recommendation import RecommendationResponse
from ..utils.error_handlers import raise_not_found
from ..auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/evaluations/{evaluation_id}/recommendations", response_model=List[RecommendationResponse])
def get_recommendations(
    evaluation_id: str,
    mode: str = Query("technical", regex="^(technical|simplified)$"),
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate prioritized mitigation recommendations (only for user's evaluations).
    """
    evaluation = db.query(Evaluation).filter(
        Evaluation.id == evaluation_id,
        Evaluation.user_id == user.id
    ).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    recommendations = db.query(Recommendation).filter(
        Recommendation.evaluation_id == evaluation_id
    ).order_by(Recommendation.priority.desc()).all()

    return recommendations


@router.get("/recommendations/{recommendation_id}", response_model=RecommendationResponse)
def get_recommendation(
    recommendation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed recommendation with examples and resources (only for user's evaluations).
    """
    # Join with Evaluation to verify ownership
    recommendation = db.query(Recommendation).join(
        Evaluation, Recommendation.evaluation_id == Evaluation.id
    ).filter(
        Recommendation.id == recommendation_id,
        Evaluation.user_id == user.id
    ).first()

    if not recommendation:
        raise_not_found("Recommendation", recommendation_id)

    return recommendation
