from sqlalchemy.orm import Session
from fastapi import HTTPException

from ..models.experiment import Experiment
from ..schemas.experiment import ExperimentCreate

class ExperimentService:
    def __init__(self, db: Session):
        self.db = db

    def create_experiment(self, experiment: ExperimentCreate) -> Experiment:
        db_experiment = Experiment(**experiment.dict())
        self.db.add(db_experiment)
        self.db.commit()
        self.db.refresh(db_experiment)
        return db_experiment

    def get_experiments(self, skip: int = 0, limit: int = 100) -> list[Experiment]:
        return self.db.query(Experiment).offset(skip).limit(limit).all()

    def get_experiment(self, experiment_id: int) -> Experiment:
        experiment = self.db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return experiment

    def delete_experiment(self, experiment_id: int) -> None:
        experiment = self.get_experiment(experiment_id)
        self.db.delete(experiment)
        self.db.commit() 