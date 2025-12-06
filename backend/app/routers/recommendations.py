from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.evaluation import Evaluation
from ..models.recommendation import Recommendation
from ..schemas.recommendation import RecommendationResponse
from ..utils.error_handlers import raise_not_found

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/evaluations/{evaluation_id}/recommendations", response_model=List[RecommendationResponse])
def get_recommendations(
    evaluation_id: str,
    mode: str = Query("technical", regex="^(technical|simplified)$"),
    db: Session = Depends(get_db)
):
    """
    Generate prioritized mitigation recommendations.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    if not evaluation:
        raise_not_found("Evaluation", evaluation_id)

    recommendations = db.query(Recommendation).filter(
        Recommendation.evaluation_id == evaluation_id
    ).order_by(Recommendation.priority.desc()).all()

    return recommendations


@router.get("/recommendations/{recommendation_id}", response_model=RecommendationResponse)
def get_recommendation(
    recommendation_id: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed recommendation with examples and resources.
    """
    recommendation = db.query(Recommendation).filter(
        Recommendation.id == recommendation_id
    ).first()

    if not recommendation:
        raise_not_found("Recommendation", recommendation_id)

    return recommendation
