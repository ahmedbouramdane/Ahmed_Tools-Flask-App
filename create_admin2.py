from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    email = "Ahmedbouramdane@gmail.com"
    username = "Ahmed Admin2"
    password = "Ahmed Admin2"
    
    admin = User.query.filter_by(email=email).first()
    if admin:
        print("Admin user already exists with this email. Updating password and verification status...")
        admin.set_password(password)
        admin.username = username
        admin.email_verified = True
        db.session.commit()
        print("Admin user updated.")
    else:
        admin = User(username=username, email=email, email_verified=True)
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        print("Admin user created successfully.")
