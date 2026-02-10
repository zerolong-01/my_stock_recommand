from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from . import models, database
from .api import endpoints

app = FastAPI(title="Stock Analysis System")

# Create tables (For simplicity, use Alembic in production)
models.Base.metadata.create_all(bind=database.engine)

app.include_router(endpoints.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Stock Analysis System API"}
