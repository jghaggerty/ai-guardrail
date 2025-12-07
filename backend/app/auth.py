"""
JWT Authentication middleware for FastAPI.
Validates Supabase JWT tokens and extracts user information.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
from pydantic import BaseModel

from .config import settings


# Security scheme for Bearer token
security = HTTPBearer()


class AuthenticatedUser(BaseModel):
    """Represents an authenticated user from the JWT token."""
    id: str  # Supabase user UUID
    email: Optional[str] = None
    role: str = "authenticated"


class JWTAuthError(HTTPException):
    """Custom exception for authentication errors."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_jwt_token(token: str) -> dict:
    """
    Decode and validate a Supabase JWT token.

    Args:
        token: The JWT token string

    Returns:
        The decoded token payload

    Raises:
        JWTAuthError: If the token is invalid or expired
    """
    try:
        # Supabase uses HS256 algorithm with the JWT secret
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise JWTAuthError("Token has expired")
    except jwt.InvalidAudienceError:
        raise JWTAuthError("Invalid token audience")
    except jwt.InvalidTokenError as e:
        raise JWTAuthError(f"Invalid token: {str(e)}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthenticatedUser:
    """
    FastAPI dependency to extract and validate the current user from JWT.

    Usage:
        @router.get("/protected")
        def protected_route(user: AuthenticatedUser = Depends(get_current_user)):
            return {"user_id": user.id}

    Args:
        credentials: The HTTP Authorization header with Bearer token

    Returns:
        AuthenticatedUser with user information from the token

    Raises:
        HTTPException: 401 if token is missing or invalid
    """
    token = credentials.credentials
    payload = decode_jwt_token(token)

    # Extract user info from Supabase JWT claims
    user_id = payload.get("sub")
    if not user_id:
        raise JWTAuthError("Token missing user ID")

    return AuthenticatedUser(
        id=user_id,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[AuthenticatedUser]:
    """
    FastAPI dependency for optional authentication.
    Returns None if no token is provided, or the user if valid token exists.

    Useful for endpoints that work differently for authenticated vs anonymous users.
    """
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
