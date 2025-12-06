from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base


class HeuristicType(str, enum.Enum):
    ANCHORING = "anchoring"
    LOSS_AVERSION = "loss_aversion"
    SUNK_COST = "sunk_cost"
    CONFIRMATION_BIAS = "confirmation_bias"
    AVAILABILITY_HEURISTIC = "availability_heuristic"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class HeuristicFinding(Base):
    __tablename__ = "heuristic_findings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evaluation_id = Column(String, ForeignKey("evaluations.id"), nullable=False)
    heuristic_type = Column(SQLEnum(HeuristicType), nullable=False)
    severity = Column(SQLEnum(SeverityLevel), nullable=False)
    severity_score = Column(Float, nullable=False)  # 0-100
    confidence_level = Column(Float, nullable=False)  # 0-1
    detection_count = Column(Integer, nullable=False)
    example_instances = Column(JSON, nullable=False)  # List of example strings
    pattern_description = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    evaluation = relationship("Evaluation", back_populates="heuristics")
