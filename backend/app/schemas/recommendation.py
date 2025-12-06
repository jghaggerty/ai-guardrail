from pydantic import BaseModel
from datetime import datetime
from ..models.recommendation import ImpactLevel, DifficultyLevel


class RecommendationResponse(BaseModel):
    id: str
    evaluation_id: str
    heuristic_type: str
    priority: int
    action_title: str
    technical_description: str
    simplified_description: str
    estimated_impact: ImpactLevel
    implementation_difficulty: DifficultyLevel
    created_at: datetime

    class Config:
        from_attributes = True
