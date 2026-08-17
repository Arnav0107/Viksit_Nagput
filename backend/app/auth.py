import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# JWT Configuration
SECRET_KEY = os.getenv(
    "SECRET_KEY", "nagpur-auditchain-secure-jwt-key-2026-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Password Hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Scheme for Bearer token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generates a bcrypt password hash."""
    return pwd_context.hash(password)


# Raw demo account credentials (hashed at module load, never kept as stored hash source)
_RAW_DEMO_USERS = [
    {
        "username": "auditor_nmc",
        "role": "auditor",
        "plain_password": "auditor123",
        "display_name": "NMC Lead Auditor",
        "ward": None,
    },
    {
        "username": "officer_ward7",
        "role": "officer",
        "plain_password": "officer123",
        "display_name": "Ward Zone Officer",
        "ward": "Sataranjipura",
    },
    {
        "username": "citizen_nagpur",
        "role": "public",
        "plain_password": "public123",
        "display_name": "Public Transparency",
        "ward": None,
    },
]

# Hardcoded demo credential store with hashed passwords
DEMO_CREDENTIALS: Dict[str, Dict[str, Any]] = {
    u["username"]: {
        "username": u["username"],
        "role": u["role"],
        "hashed_password": get_password_hash(u["plain_password"]),
        "display_name": u["display_name"],
        "ward": u.get("ward"),
    }
    for u in _RAW_DEMO_USERS
}

# Exposed demo credentials metadata (for startup logging and UI convenience)
DEMO_ACCOUNTS_METADATA = [
    {
        "username": u["username"],
        "role": u["role"],
        "password": u["plain_password"],
        "display_name": u["display_name"],
        "ward": u.get("ward"),
    }
    for u in _RAW_DEMO_USERS
]


def create_access_token(username: str, role: str, ward: Optional[str] = None, expires_delta: Optional[timedelta] = None) -> str:
    """Issues a signed JWT with `sub`, `role`, and expiration claims."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + \
            timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": username,
        "role": role,
        "ward": ward,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Dict[str, str]:
    """Decodes the JWT Bearer token and returns user details or raises 401."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        ward: Optional[str] = payload.get("ward")
        if username is None or role is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"username": username, "role": role, "ward": ward}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(*allowed_roles: str):
    """
    Dependency factory to enforce server-side role-based access control.
    Raises 403 Forbidden if user's role is not among allowed_roles.
    """
    def role_verifier(current_user: Dict[str, str] = Depends(get_current_user)) -> Dict[str, str]:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Access denied for role '{user_role}'. Required one of: {list(allowed_roles)}.",
            )
        return current_user

    return role_verifier
