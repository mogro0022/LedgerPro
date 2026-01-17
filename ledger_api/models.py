from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Customer(Base):
    __tablename__ = "Customers"
    # By default, SQLAlchemy assumes 'dbo' schema for SQL Server

    CustomerID = Column(Integer, primary_key=True, index=True)
    CustomerName = Column(String(100))
    Email = Column(String(255))
    PhoneNumber = Column(String(20))
    HomeAddress = Column(String(500))

    # Relationship: One Customer has many Transactions
    transactions = relationship("Transaction", back_populates="customer")


class Transaction(Base):
    __tablename__ = "Transactions"
    TransactionID = Column(Integer, primary_key=True, index=True)
    CustomerID = Column(Integer, ForeignKey("Customers.CustomerID"))
    Amount = Column(DECIMAL(18, 2))
    EntryDate = Column(DateTime)  # datetime2 maps to DateTime in Python
    Notes = Column(String, nullable=True)
    # Relationship: A Transaction belongs to one Customer
    customer = relationship("Customer", back_populates="transactions")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)
