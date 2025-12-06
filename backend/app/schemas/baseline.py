from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime


class StatisticalParams(BaseModel):
    mean: float
    std_dev: float
    sample_size: int


class BaselineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    evaluation_id: Optional[str] = None
    zone_thresholds: Optional[Dict[str, float]] = None


class BaselineResponse(BaseModel):
    id: str
    name: str
    green_zone_max: float
    yellow_zone_max: float
    statistical_params: Dict[str, float]
    created_at: datetime

    class Config:
        from_attributes = True
