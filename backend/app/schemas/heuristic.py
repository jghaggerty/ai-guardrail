from pydantic import BaseModel
from typing import List
from datetime import datetime
from ..models.heuristic import HeuristicType, SeverityLevel


class HeuristicFindingResponse(BaseModel):
    id: str
    evaluation_id: str
    heuristic_type: HeuristicType
    severity: SeverityLevel
    severity_score: float
    confidence_level: float
    detection_count: int
    example_instances: List[str]
    pattern_description: str
    created_at: datetime

    class Config:
        from_attributes = True
