from sqlalchemy import Column, String, Integer, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from ..database import Base


class ImpactLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MODERATE = "moderate"
    COMPLEX = "complex"


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evaluation_id = Column(String, ForeignKey("evaluations.id"), nullable=False)
    heuristic_type = Column(String, nullable=False)
    priority = Column(Integer, nullable=False)  # 1-10
    action_title = Column(String, nullable=False)
    technical_description = Column(String, nullable=False)
    simplified_description = Column(String, nullable=False)
    estimated_impact = Column(SQLEnum(ImpactLevel), nullable=False)
    implementation_difficulty = Column(SQLEnum(DifficultyLevel), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    evaluation = relationship("Evaluation", back_populates="recommendations")
