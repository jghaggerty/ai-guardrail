from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from ..models.evaluation import ZoneStatus


class TrendDataPoint(BaseModel):
    timestamp: datetime
    score: float
    zone: ZoneStatus


class TrendResponse(BaseModel):
    evaluation_id: str
    data_points: List[TrendDataPoint]
    current_zone: ZoneStatus
    drift_alert: bool
    drift_message: Optional[str] = None

    class Config:
        from_attributes = True
