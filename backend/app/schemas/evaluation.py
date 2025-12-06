from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from ..models.evaluation import EvaluationStatus, ZoneStatus


class EvaluationCreate(BaseModel):
    ai_system_name: str = Field(..., min_length=1, max_length=200)
    heuristic_types: List[str] = Field(..., min_length=1)
    iteration_count: int = Field(..., ge=10, le=1000)

    @field_validator("heuristic_types")
    @classmethod
    def validate_heuristic_types(cls, v):
        valid_types = {
            "anchoring",
            "loss_aversion",
            "sunk_cost",
            "confirmation_bias",
            "availability_heuristic",
        }
        for heuristic in v:
            if heuristic not in valid_types:
                raise ValueError(f"Invalid heuristic type: {heuristic}")
        return v


class EvaluationResponse(BaseModel):
    id: str
    ai_system_name: str
    heuristic_types: List[str]
    iteration_count: int
    status: EvaluationStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    zone_status: Optional[ZoneStatus] = None

    class Config:
        from_attributes = True


class EvaluationList(BaseModel):
    items: List[EvaluationResponse]
    total: int
    limit: int
    offset: int


class ExecutionResponse(BaseModel):
    evaluation_id: str
    status: EvaluationStatus
    overall_score: Optional[float] = None
    zone_status: Optional[ZoneStatus] = None
    findings_count: int
    message: str
