"""Clinical Timeline — per-patient chronological event audit log."""
from __future__ import annotations
import asyncio
import uuid
from collections import deque
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(tags=["timeline"])

PATIENT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 9)]

SEV_ORDER = {"INFO": 0, "WARN": 1, "URGENT": 2, "CRITICAL": 3}


class ClinicalTimeline:
    def __init__(self):
        self.events: dict[str, deque] = {pid: deque(maxlen=200) for pid in PATIENT_IDS}
        self._last_news2: dict[str, int] = {}
        self._last_alert_ids: dict[str, set] = {}

    def add_event(self, patient_id: str, event_type: str, title: str, detail: str,
                  severity: str, triggered_by: str, data_snapshot: dict) -> dict:
        if patient_id not in self.events:
            self.events[patient_id] = deque(maxlen=200)
        event = {
            "event_id": str(uuid.uuid4())[:8],
            "patient_id": patient_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "title": title,
            "detail": detail,
            "severity": severity,
            "triggered_by": triggered_by,
            "data_snapshot": data_snapshot,
        }
        self.events[patient_id].append(event)
        return event

    def get_patient_events(self, patient_id: str) -> list:
        evts = list(self.events.get(patient_id, deque()))
        return list(reversed(evts))

    def get_patient_summary(self, patient_id: str) -> dict:
        evts = self.get_patient_events(patient_id)
        counts: dict[str, int] = {}
        for e in evts:
            counts[e["event_type"]] = counts.get(e["event_type"], 0) + 1
        return {
            "patient_id": patient_id,
            "total_events": len(evts),
            "by_type": counts,
            "first_event": evts[-1]["timestamp"] if evts else None,
            "last_event": evts[0]["timestamp"] if evts else None,
        }

    def get_department_events(self, limit: int = 100) -> list:
        all_evts = []
        for pid in PATIENT_IDS:
            all_evts.extend(list(self.events.get(pid, deque())))
        all_evts.sort(key=lambda e: e["timestamp"], reverse=True)
        return all_evts[:limit]

    async def auto_record_continuous(self):
        from core.vitals_engine import get_vitals_engine
        from core.deterioration import calculate_news2
        from core.alert_state import get_patient_alerts

        await asyncio.sleep(8)
        while True:
            try:
                engine = get_vitals_engine()
                all_vitals = engine.get_all_current_vitals()
                for pid, vitals in all_vitals.items():
                    news2 = calculate_news2(vitals)
                    prev = self._last_news2.get(pid)
                    if prev is not None and abs(news2.score - prev) >= 2:
                        direction = "increased" if news2.score > prev else "decreased"
                        change = abs(news2.score - prev)
                        sev = "CRITICAL" if news2.score >= 7 else "URGENT" if news2.score >= 5 else "WARN"
                        self.add_event(
                            pid, "NEWS2_CHANGE",
                            f"NEWS2 {direction}: {prev}→{news2.score}",
                            f"NEWS2 score {direction} by {change} points to {news2.score}/20 ({news2.risk_level.value})",
                            sev, "VITALS_ENGINE",
                            {"previous": prev, "current": news2.score, "change": news2.score - prev}
                        )
                    self._last_news2[pid] = news2.score

                    alerts = get_patient_alerts(pid)
                    if pid not in self._last_alert_ids:
                        self._last_alert_ids[pid] = set()
                    current_ids = {a.alert_id for a in alerts}
                    new_ids = current_ids - self._last_alert_ids[pid]
                    for aid in new_ids:
                        alert = next((a for a in alerts if a.alert_id == aid), None)
                        if alert:
                            self.add_event(
                                pid, "ALERT_GENERATED",
                                alert.title,
                                alert.body,
                                alert.severity.value,
                                "SYSTEM",
                                {"alert_id": aid, "alert_type": alert.alert_type.value}
                            )
                    self._last_alert_ids[pid] = current_ids
            except Exception:
                pass
            await asyncio.sleep(30)


clinical_timeline = ClinicalTimeline()


@router.get("/timeline/department")
def get_department_timeline():
    return clinical_timeline.get_department_events(100)


@router.get("/timeline/{patient_id}/summary")
def get_timeline_summary(patient_id: str):
    return clinical_timeline.get_patient_summary(patient_id)


@router.get("/timeline/{patient_id}")
def get_patient_timeline(patient_id: str):
    return clinical_timeline.get_patient_events(patient_id)
