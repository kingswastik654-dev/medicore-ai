from fastapi import APIRouter

from app.api.v1 import (
    ai,
    analytics,
    appointments,
    auth,
    audits,
    billing,
    blood,
    ed,
    emr,
    facilities,
    hr,
    ipd,
    labs,
    leads,
    notifications,
    ot,
    patients,
    plugins,
    prescriptions,
    radiology,
    tele,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(patients.router)
api_router.include_router(appointments.router)
api_router.include_router(billing.router)
api_router.include_router(analytics.router)
api_router.include_router(audits.router)
api_router.include_router(emr.router)
api_router.include_router(prescriptions.router)
api_router.include_router(labs.router)
api_router.include_router(radiology.router)
api_router.include_router(ot.router)
api_router.include_router(blood.router)
api_router.include_router(ed.router)
api_router.include_router(hr.router)
api_router.include_router(ai.router)
api_router.include_router(facilities.router)
api_router.include_router(tele.router)
api_router.include_router(plugins.router)
api_router.include_router(notifications.router)
api_router.include_router(leads.router)
api_router.include_router(ipd.router)
