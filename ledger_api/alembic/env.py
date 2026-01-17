import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.engine import URL
from alembic import context
from dotenv import load_dotenv

# 1. Add parent directory to path so we can find 'models.py'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 2. Import your models
from models import Base

# 3. Load .env file
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 4. Set the Metadata object so Alembic can "see" your tables
target_metadata = Base.metadata


# ---------------------------------------------------------
# HELPER: Transform the .env string into a SQLAlchemy URL
# ---------------------------------------------------------
def get_url():
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raise ValueError("DATABASE_URL is not set in .env")

    # If it's the complex Azure string, convert it
    if "ODBC Driver" in raw_url:
        return URL.create(
            "mssql+pyodbc", query={"odbc_connect": raw_url}
        ).render_as_string(hide_password=False)

    # Otherwise (SQLite), return as is
    return raw_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    # 5. Inject our corrected URL into the config
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
