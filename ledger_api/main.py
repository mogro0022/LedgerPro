from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Optional
import models, database, auth
from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import datetime, timedelta
import os

app = FastAPI()

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This tells FastAPI that the token is located in the "Authorization: Bearer" header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# ===========================
# 1. AUTH DEPENDENCY
# ===========================
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Verify signature and expiration
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except auth.JWTError:
        raise credentials_exception

    # Check if user exists in DB
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


# ===========================
# 2. PYDANTIC SCHEMAS
# ===========================


# --- Auth Models ---
class Token(BaseModel):
    access_token: str
    token_type: str
    is_admin: bool  # Sent to frontend to show/hide admin button


class UserCreate(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool

    class Config:
        from_attributes = True


# --- Transaction Models ---
class TransactionBase(BaseModel):
    Amount: Decimal
    EntryDate: datetime
    Notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    CustomerID: int


class TransactionResponse(TransactionBase):
    TransactionID: int
    CustomerID: int

    class Config:
        from_attributes = True


# --- Customer Models ---
class CustomerBase(BaseModel):
    CustomerName: str
    Email: Optional[str] = None
    PhoneNumber: Optional[str] = None
    HomeAddress: Optional[str] = None

    @field_validator(
        "CustomerName", "Email", "PhoneNumber", "HomeAddress", mode="before"
    )
    @classmethod
    def clean_data(cls, v):
        return v.strip() if isinstance(v, str) and v.strip() else None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    CustomerID: int
    transactions: List[TransactionResponse] = []  # Nested data

    class Config:
        from_attributes = True


class BalanceResponse(BaseModel):
    CustomerID: int
    CustomerName: str
    Balance: Decimal


# ===========================
# 3. AUTH ENDPOINTS
# ===========================


@app.post("/token", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db),
):
    # 1. Find User
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    # 2. Verify Password (using Argon2)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Generate Token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # 4. Return Token + Admin Status
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "is_admin": user.is_admin,
    }


@app.post("/admin/create-user", response_model=Token)
def create_user_by_admin(
    new_user: UserCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    # GATEKEEPER: Only Admins can enter
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403, detail="Not authorized. Admin access required."
        )

    if db.query(models.User).filter(models.User.email == new_user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user (default is_admin=False)
    db_user = models.User(
        email=new_user.email,
        hashed_password=auth.get_password_hash(new_user.password),
        is_admin=False,
    )
    db.add(db_user)
    db.commit()

    return {"access_token": "", "token_type": "bearer", "is_admin": False}


@app.get("/admin/users", response_model=List[UserResponse])
def read_users(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized.")
    return db.query(models.User).all()


@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized.")

    # Prevent suicide (Admin deleting themselves)
    if current_user.id == user_id:
        raise HTTPException(
            status_code=400, detail="You cannot delete your own account."
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


# ===========================
# 4. DATA ENDPOINTS (Protected)
# ===========================


@app.get("/customers/", response_model=List[CustomerResponse])
def read_customers(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    # PERFORMANCE FIX: 'joinedload' fetches everything in 1 query
    return (
        db.query(models.Customer)
        .options(joinedload(models.Customer.transactions))
        .all()
    )


@app.post("/customers/", response_model=CustomerResponse)
def create_customer(
    cust: CustomerCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Check for duplicates
    existing = (
        db.query(models.Customer)
        .filter(
            models.Customer.CustomerName == cust.CustomerName,
            or_(
                models.Customer.Email == cust.Email,
                models.Customer.PhoneNumber == cust.PhoneNumber,
            ),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400, detail="Customer with this contact info already exists."
        )

    db_customer = models.Customer(**cust.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    cust_update: CustomerUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_customer = (
        db.query(models.Customer)
        .filter(models.Customer.CustomerID == customer_id)
        .first()
    )
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = cust_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_customer, key, value)

    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.get("/customers/search/", response_model=List[BalanceResponse])
def search_customers(
    query: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    customers = (
        db.query(models.Customer)
        .filter(
            or_(
                models.Customer.CustomerName.ilike(f"%{query}%"),
                models.Customer.HomeAddress.ilike(f"%{query}%"),
            )
        )
        .all()
    )

    if not customers:
        raise HTTPException(
            status_code=404, detail=f"No customers found matching '{query}'."
        )

    results = []
    for cust in customers:
        total = db.query(func.sum(models.Transaction.Amount)).filter(
            models.Transaction.CustomerID == cust.CustomerID
        ).scalar() or Decimal("0.00")

        results.append(
            {
                "CustomerID": cust.CustomerID,
                "CustomerName": cust.CustomerName,
                "Balance": total,
            }
        )

    return results


@app.post("/transactions/", response_model=TransactionResponse)
def create_transaction(
    tx: TransactionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    if (
        not db.query(models.Customer)
        .filter(models.Customer.CustomerID == tx.CustomerID)
        .first()
    ):
        raise HTTPException(status_code=404, detail="Customer not found")

    db_tx = models.Transaction(
        CustomerID=tx.CustomerID,
        Amount=tx.Amount,
        EntryDate=tx.EntryDate,
        Notes=tx.Notes,
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx


@app.get("/transactions/", response_model=List[TransactionResponse])
def read_transactions(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Transaction).all()

    # ... (existing imports and API routes above) ...

    # 1. Mount the "assets" folder (CSS/JS images)


if os.path.isdir("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    # 2. Catch-All Route (For React Router)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Construct the full path to the requested file
        file_path = f"dist/{full_path}"

        # CRITICAL FIX: Only serve if it is a FILE, not a folder
        if full_path != "" and os.path.isfile(file_path):
            return FileResponse(file_path)

        # For everything else (root URL, folders, unknown routes), serve index.html
        return FileResponse("dist/index.html")
else:
    print("⚠️ Warning: 'dist' folder not found. Frontend will not be served.")
