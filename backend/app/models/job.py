from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship

from .base import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"))
    name = Column(String, nullable=False)
    status = Column(String, default="pending")
    model_type = Column(String, nullable=False)
    parameters = Column(JSON, nullable=False)

    best_accuracy = Column(Float, nullable=True)
    total_time = Column(Float, nullable=True)
    epochs_completed = Column(Integer, default=0)
    history = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    experiment = relationship("Experiment", back_populates="jobs") 