from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any


@dataclass
class ClientConnection:
    """Represents a client browser that has recently pinged the backend."""
    id: str
    ip: str
    user_agent: str
    last_seen: datetime

    @property
    def online(self) -> bool:
        return True

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["last_seen"] = self.last_seen.isoformat()
        data["online"] = self.online
        return data


_clients: Dict[str, ClientConnection] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def register_client_ping(client_id: str, ip: str, user_agent: str) -> None:
    """
    Register or update a client heartbeat.

    client_id can be any stable identifier from the frontend (e.g. random UUID in localStorage)
    or fall back to IP address when not provided.
    """
    global _clients
    key = client_id or ip
    if not key:
        return

    existing = _clients.get(key)
    if existing:
        existing.last_seen = _now()
        # Update IP / UA in case they changed
        existing.ip = ip
        existing.user_agent = user_agent
    else:
        _clients[key] = ClientConnection(
            id=key,
            ip=ip,
            user_agent=user_agent,
            last_seen=_now(),
        )


def get_active_clients(max_age_seconds: int = 60) -> List[Dict[str, Any]]:
    """
    Return clients that have pinged within the last `max_age_seconds`.
    """
    cutoff = _now() - timedelta(seconds=max_age_seconds)
    active: List[Dict[str, Any]] = []
    for c in list(_clients.values()):
        if c.last_seen >= cutoff:
            active.append(c.to_dict())
    return active

