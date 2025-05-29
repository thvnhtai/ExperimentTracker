import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from ..models.base import get_db
from ..models.job import Job
from models.mnist_models import create_model
from models.trainer import train_model

ws_connections = {}

async def send_ws_update(job_id: str, data: dict):
    disconnected_clients = []
    for client_id, websocket in ws_connections.items():
        try:
            await websocket.send_json({"job_id": job_id, "data": data})
        except:
            disconnected_clients.append(client_id)
    
    for client_id in disconnected_clients:
        if client_id in ws_connections:
            del ws_connections[client_id]

async def training_status_callback(status_data):
    job_id = status_data.get("job_id")
    
    async def update_job_in_db():
        db = next(get_db())
        job = db.query(Job).filter(Job.job_id == job_id).first()
        
        if not job:
            return
        
        if "epoch" in status_data:
            job.epochs_completed = status_data["epoch"]
        
        if status_data.get("status") == "completed" and "final_results" in status_data:
            results = status_data["final_results"]
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.best_accuracy = results.get("best_accuracy")
            job.total_time = results.get("total_time")
            job.history = results.get("history")
        elif status_data.get("status") == "failed":
            job.status = "failed"
            job.completed_at = datetime.utcnow()
        
        db.commit()
    
    loop = asyncio.get_event_loop()
    asyncio.create_task(update_job_in_db())
    
    await send_ws_update(job_id, status_data)

def run_training_job(job_id: str, model_type: str, parameters: dict):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    db = next(get_db())
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if job:
        job.status = "running"
        job.started_at = datetime.utcnow()
        db.commit()
    
    try:
        # Create model
        model_params = {k: v for k, v in parameters.items() 
                       if k in ['dropout_rate', 'hidden_size', 'kernel_size', 'num_layers']}
        model = create_model(model_type, **model_params)
        
        training_params = {k: v for k, v in parameters.items() 
                          if k not in ['dropout_rate', 'hidden_size', 'kernel_size', 'num_layers']}
        
        def status_callback(status_data):
            loop.run_until_complete(training_status_callback(status_data))
        
        train_model(model, job_id, training_params, status_callback)
    
    except Exception as e:
        error_info = {
            "job_id": job_id,
            "status": "failed",
            "error": str(e)
        }
        loop.run_until_complete(training_status_callback(error_info))
    
    finally:
        loop.close() 