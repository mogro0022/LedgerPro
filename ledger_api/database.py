from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import urllib.parse
from dotenv import load_dotenv

# 1. Load variables from .env
load_dotenv()

# 2. Get the raw connection string
#    Example for SQLite: "sqlite:///./ledger.db"
#    Example for Azure:  "Driver={ODBC Driver 18...};Server=tcp:..."
raw_db_url = os.getenv("DATABASE_URL")

if not raw_db_url:
    raise ValueError("DATABASE_URL is not set in the .env file")

# 3. Configure the Engine based on the Database Type
if "sqlite" in raw_db_url:
    # --- SQLITE SETTINGS ---
    # SQLite is a file, not a server. It needs specific threading args for FastAPI.
    print(f"💽 Database Mode: Local SQLite ({raw_db_url})")

    engine = create_engine(
        raw_db_url,
        connect_args={"check_same_thread": False},  # CRITICAL for SQLite + FastAPI
    )

else:
    # --- AZURE / MSSQL SETTINGS ---
    # Azure SQL needs the URL to be "URL Encoded" to handle special characters in passwords.
    print("☁️  Database Mode: Azure SQL / MSSQL")

    # Encode the raw connection string safely
    params = urllib.parse.quote_plus(raw_db_url)

    # Construct the SQLAlchemy connection string
    final_url = f"mssql+pyodbc:///?odbc_connect={params}"

    engine = create_engine(final_url)

# 4. Create the Session Factory
#    This is what creates the "database session" for every request.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5. Create the Base Class
#    All your models (in models.py) will inherit from this.
Base = declarative_base()


# 6. Dependency Injection
#    This function is used in main.py to give every route a safe database connection.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

