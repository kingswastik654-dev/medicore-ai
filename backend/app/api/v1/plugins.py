from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Plugin, User
from app.services.audit import from_request

router = APIRouter(prefix="/plugins", tags=["plugins"])

admin_access = require_roles("FACILITY_ADMIN")


def _out(p: Plugin) -> dict:
    return {
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "category": p.category,
        "description": p.description,
        "version": p.version,
        "vendor": p.vendor,
        "enabled": p.enabled,
    }


@router.get("")
def list_plugins(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plugins = db.scalars(select(Plugin).order_by(Plugin.enabled.desc(), Plugin.name)).all()
    return [_out(p) for p in plugins]


class PluginInstall(BaseModel):
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=2, max_length=150)
    category: str = Field(default="ANALYTICS", max_length=20)
    description: str = Field(default="", max_length=1000)
    version: str = Field(default="1.0.0", max_length=15)
    vendor: str | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
def install_plugin(
    payload: PluginInstall,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(admin_access),
):
    if db.scalar(select(Plugin).where(Plugin.slug == payload.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Plugin already installed")
    plugin = Plugin(
        slug=payload.slug,
        name=payload.name,
        category=payload.category,
        description=payload.description,
        version=payload.version,
        vendor=payload.vendor,
        enabled=False,
    )
    db.add(plugin)
    from_request(db, request, user, "INSTALL", "plugin", resource_id=payload.slug)
    db.commit()
    db.refresh(plugin)
    return _out(plugin)


@router.post("/{plugin_id}/toggle")
def toggle_plugin(
    plugin_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(admin_access),
):
    plugin = db.get(Plugin, plugin_id)
    if not plugin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plugin not found")
    plugin.enabled = not plugin.enabled
    from_request(
        db, request, user, "UPDATE", "plugin",
        resource_id=plugin.slug,
        detail=f"enabled={str(plugin.enabled).lower()}",
    )
    db.commit()
    return _out(plugin)
