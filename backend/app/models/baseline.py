from sqlalchemy import Column, String, Float, DateTime, JSON
from datetime import datetime
import uuid
from ..database import Base


class Baseline(Base):
    __tablename__ = "baselines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)  # Supabase user UUID
    name = Column(String, nullable=False)
    green_zone_max = Column(Float, nullable=False)
    yellow_zone_max = Column(Float, nullable=False)
    statistical_params = Column(JSON, nullable=False)  # {mean, std_dev, sample_size}
    created_at = Column(DateTime, default=datetime.utcnow)
