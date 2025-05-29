import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, BackgroundTasks

from ..models.job import Job
from ..models.experiment import Experiment
from ..schemas.job import JobCreate
from ..utils.training import run_training_job

class JobService:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, job: JobCreate, background_tasks: BackgroundTasks) -> Job:
        experiment = self.db.query(Experiment).filter(Experiment.id == job.experiment_id).first()
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")

        # Check for duplicate jobs
        existing_job = self._find_duplicate_job(job)
        if existing_job:
            return existing_job

        job_id = str(uuid.uuid4())
        db_job = Job(
            job_id=job_id,
            name=job.name,
            experiment_id=job.experiment_id,
            model_type=job.model_type,
            parameters=job.parameters.dict(),
            status="pending"
        )

        self.db.add(db_job)
        self.db.commit()
        self.db.refresh(db_job)

        background_tasks.add_task(
            run_training_job,
            job_id=job_id,
            model_type=job.model_type,
            parameters=job.parameters.dict()
        )

        return db_job

    def get_jobs(self, experiment_id: int = None, skip: int = 0, limit: int = 100) -> list[Job]:
        query = self.db.query(Job)
        if experiment_id:
            query = query.filter(Job.experiment_id == experiment_id)
        return query.offset(skip).limit(limit).all()

    def get_job(self, job_id: str) -> Job:
        job = self.db.query(Job).filter(Job.job_id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job

    def delete_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        self.db.delete(job)
        self.db.commit()

    def cancel_job(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if job.status not in ["pending", "running"]:
            raise HTTPException(status_code=400, detail="Job cannot be cancelled")
        
        job.status = "cancelled"
        job.completed_at = datetime.utcnow()
        self.db.commit()

    def _find_duplicate_job(self, job: JobCreate) -> Job | None:
        existing_jobs = self.db.query(Job).filter(
            Job.experiment_id == job.experiment_id,
            Job.model_type == job.model_type
        ).all()

        job_params = job.parameters.dict()
        
        for existing_job in existing_jobs:
            existing_params = existing_job.parameters
            
            # Check core parameters
            core_match = (
                existing_params.get('optimizer') == job_params.get('optimizer') and
                existing_params.get('learning_rate') == job_params.get('learning_rate') and
                existing_params.get('batch_size') == job_params.get('batch_size') and
                existing_params.get('epochs') == job_params.get('epochs')
            )
            
            if not core_match:
                continue

            # Check model-specific parameters
            specific_params_match = False
            if job.model_type == 'mlp':
                specific_params_match = (
                    existing_params.get('hidden_size') == job_params.get('hidden_size') and
                    existing_params.get('dropout_rate') == job_params.get('dropout_rate') and
                    existing_params.get('num_layers') == job_params.get('num_layers')
                )
            elif job.model_type == 'cnn':
                specific_params_match = (
                    existing_params.get('kernel_size') == job_params.get('kernel_size')
                )

            if core_match and specific_params_match:
                return existing_job

        return None 