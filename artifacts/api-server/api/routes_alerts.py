import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import ClinicalAlert, AlertCount
from core.alert_state import (
    get_all_alerts, get_patient_alerts, acknowledge_alert, count_unacknowledged
)

router = APIRouter(tags=["alerts"])


@router.get("/alerts/all", response_model=list[ClinicalAlert])
def get_all_alerts_endpoint():
    return get_all_alerts()


@router.get("/alerts/unacknowledged/count", response_model=AlertCount)
def get_unacknowledged_count():
    return AlertCount(count=count_unacknowledged())


@router.get("/alerts/{patient_id}", response_model=list[ClinicalAlert])
def get_patient_alerts_endpoint(patient_id: str):
    return get_patient_alerts(patient_id)


@router.post("/alerts/{alert_id}/acknowledge", response_model=ClinicalAlert)
def acknowledge_alert_endpoint(alert_id: str):
    alert = acknowledge_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/alerts/stream")
async def stream_alerts():
    """SSE stream for new alerts."""
    async def generate():
        import time
        last_count = len(get_all_alerts())
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"

        while True:
            await asyncio.sleep(2)
            current_alerts = get_all_alerts()
            current_count = len(current_alerts)
            if current_count > last_count:
                new_alerts = current_alerts[:current_count - last_count]
                for alert in new_alerts:
                    yield f"data: {alert.model_dump_json()}\n\n"
                last_count = current_count

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
