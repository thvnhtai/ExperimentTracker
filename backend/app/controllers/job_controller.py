from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from ..models.base import get_db
from ..schemas.job import JobCreate, JobResponse, JobWithHistory
from ..services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("/", response_model=JobResponse)
def create_job(
    job: JobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.create_job(job, background_tasks)

@router.get("/", response_model=list[JobResponse])
def read_jobs(
    experiment_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.get_jobs(experiment_id, skip, limit)

@router.get("/{job_id}", response_model=JobWithHistory)
def read_job(
    job_id: str,
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.get_job(job_id)

@router.delete("/{job_id}")
def delete_job(
    job_id: str,
    db: Session = Depends(get_db)
):
    service = JobService(db)
    service.delete_job(job_id)
    return {"message": "Job deleted successfully"}

@router.post("/{job_id}/cancel")
def cancel_job(
    job_id: str,
    db: Session = Depends(get_db)
):
    service = JobService(db)
    service.cancel_job(job_id)
    return {"message": "Job cancelled successfully"} 