from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sys
import os

# Add parent directory to path to import auth module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import decode_access_token

security = HTTPBearer()

async def require_canvasser(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require canvasser role for access"""
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    role = payload.get("role", "").lower()
    if role != "canvasser":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Canvasser role required."
        )
    
    return payload