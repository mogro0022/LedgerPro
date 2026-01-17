from database import SessionLocal
from models import User
from argon2 import PasswordHasher  # <--- USING YOUR EXISTING LIBRARY
from argon2.exceptions import VerifyMismatchError

# Initialize the hasher
ph = PasswordHasher()


def create_admin():
    db = SessionLocal()

    email = input("Enter email for new admin: ")
    password = input("Enter password: ")

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        print("❌ Error: User with that email already exists.")
        return

    # Hash the password using Argon2 directly
    hashed_password = ph.hash(password)

    # Create the User object
    new_user = User(email=email, hashed_password=hashed_password, is_admin=True)

    # Save to Database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    print(f"✅ Success! Created admin user: {new_user.email}")
    db.close()


if __name__ == "__main__":
    print("--- Create Initial User (Argon2 Native) ---")
    create_admin()
