from backend.app.database import init_db
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Experiment Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ws_connections = {}

@app.on_event("startup")
async def startup_event():
    init_db()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    ws_connections[client_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if client_id in ws_connections:
            del ws_connections[client_id]

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