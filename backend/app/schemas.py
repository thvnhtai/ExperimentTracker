from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ExperimentBase(BaseModel):
    name: str
    description: Optional[str] = None

class ExperimentCreate(ExperimentBase):
    pass

class ExperimentResponse(ExperimentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True