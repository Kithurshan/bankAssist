import bcrypt

MAX_BCRYPT_PASSWORD_BYTES = 72


def _password_bytes(password: str) -> bytes:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError("Password must be 72 bytes or fewer.")

    return password_bytes


def hash_password(password: str) -> str:
    password_bytes = _password_bytes(password)
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = _password_bytes(plain_password)
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
