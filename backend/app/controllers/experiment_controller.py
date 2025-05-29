from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..models.base import get_db
from ..schemas.experiment import ExperimentCreate, ExperimentResponse
from ..services.experiment_service import ExperimentService

router = APIRouter(prefix="/experiments", tags=["Experiments"])

@router.post("/", response_model=ExperimentResponse)
def create_experiment(
    experiment: ExperimentCreate,
    db: Session = Depends(get_db)
):
    service = ExperimentService(db)
    return service.create_experiment(experiment)

@router.get("/", response_model=list[ExperimentResponse])
def read_experiments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = ExperimentService(db)
    return service.get_experiments(skip, limit)

@router.get("/{experiment_id}", response_model=ExperimentResponse)
def read_experiment(
    experiment_id: int,
    db: Session = Depends(get_db)
):
    service = ExperimentService(db)
    return service.get_experiment(experiment_id)

@router.delete("/{experiment_id}")
def delete_experiment(
    experiment_id: int,
    db: Session = Depends(get_db)
):
    service = ExperimentService(db)
    service.delete_experiment(experiment_id)
    return {"message": "Experiment deleted successfully"} 