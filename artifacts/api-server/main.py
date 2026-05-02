"""VitalIQ FastAPI backend — ED Clinical Co-Pilot."""
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.schemas import HealthStatus
from core.vitals_engine import get_vitals_engine
from core.deterioration import calculate_news2
from core.alert_state import seed_initial_alerts, maybe_add_news2_alert
from ai.triage_agent import run_triage_cycle
from api.routes_patients import router as patients_router
from api.routes_vitals import router as vitals_router
from api.routes_ai import router as ai_router
from api.routes_drugs import router as drugs_router
from api.routes_alerts import router as alerts_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    seed_initial_alerts()
    engine = get_vitals_engine()
    engine.start()

    # Background triage refresh every 30 seconds
    async def triage_loop():
        await asyncio.sleep(5)  # initial delay
        while True:
            try:
                all_vitals = engine.get_all_current_vitals()
                all_news2 = {pid: calculate_news2(v) for pid, v in all_vitals.items()}
                await run_triage_cycle(all_vitals, all_news2)
                # Also generate NEWS2 alerts as vitals update
                for pid, news2 in all_news2.items():
                    maybe_add_news2_alert(pid, news2.score)
            except Exception:
                pass
            await asyncio.sleep(30)

    asyncio.create_task(triage_loop())
    yield
    # Shutdown


app = FastAPI(
    title="VitalIQ Clinical Co-Pilot API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check at /api/healthz
@app.get("/api/healthz", response_model=HealthStatus, tags=["health"])
def health_check():
    return HealthStatus(status="ok")

# Mount all routers at /api prefix
app.include_router(patients_router, prefix="/api")
app.include_router(vitals_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(drugs_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
