from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base


class EvaluationStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ZoneStatus(str, enum.Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)  # Supabase user UUID
    ai_system_name = Column(String, nullable=False)
    heuristic_types = Column(JSON, nullable=False)  # List of heuristic types
    iteration_count = Column(Integer, nullable=False)
    status = Column(SQLEnum(EvaluationStatus), default=EvaluationStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    overall_score = Column(Float, nullable=True)
    zone_status = Column(SQLEnum(ZoneStatus), nullable=True)

    # Relationships
    heuristics = relationship("HeuristicFinding", back_populates="evaluation", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="evaluation", cascade="all, delete-orphan")
