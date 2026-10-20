import os
import time

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException, Request

load_dotenv(override=True)

# Remember verified tokens for a short time, so we don't ask Supabase on every single request
CACHE_SECONDS = 60
_token_cache: dict[str, tuple[str, float]] = {}  # token -> (user_id, expires_at)


def supabase_config() -> dict:
    """
    The public Supabase settings the browser needs to show the login form.
    (The anon key is designed to be public. Never put the database password here.)
    """
    return {
        "supabase_url": os.getenv("SUPABASE_URL", "").rstrip("/"),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", ""),
    }


def verify_token(token: str) -> str:
    """
    Ask Supabase Auth who this access token belongs to. Returns the user's ID.
    Raises 401 if the token is invalid or expired.
    """
    now = time.time()
    cached = _token_cache.get(token)
    if cached and cached[1] > now:
        return cached[0]

    config = supabase_config()
    if not config["supabase_url"] or not config["supabase_anon_key"]:
        raise HTTPException(status_code=503, detail="Login is not configured on the server.")

    try:
        response = httpx.get(
            f"{config['supabase_url']}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": config["supabase_anon_key"]},
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not reach the login service.")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    user_id = response.json().get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid login.")

    # Keep the cache from growing forever
    if len(_token_cache) > 1000:
        _token_cache.clear()
    _token_cache[token] = (user_id, now + CACHE_SECONDS)
    return user_id


def get_owner_id(request: Request) -> str:
    """
    FastAPI dependency: the signed-in user's ID, taken from the 'Authorization: Bearer <token>' header.
    """
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in.")
    return verify_token(header[7:].strip())
