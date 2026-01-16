import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from dotenv import load_dotenv  # <--- New import
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# 1. Load the environment variables
load_dotenv()

# 🔐 SECURITY CONFIGURATION
# 2. Read the key from the .env file
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Initialize the hasher (Argon2id is the default)
ph = PasswordHasher()


def verify_password(plain_password, hashed_password):
    try:
        # Verify returns True if correct, raises VerifyMismatchError if wrong
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False


def get_password_hash(password):
    return ph.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
