from flask import Blueprint, render_template, redirect, url_for, request, flash, session, current_app
from flask_login import current_user, login_user, logout_user
from app.models import User
from app import db, mail
from flask_mail import Message
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)

VERIFY_EMAIL = True   # Enable email verification

@auth_bp.route("/")
def index():
    return render_template("index.html")

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.dashboard"))
    if request.method == "POST":
        username = request.form.get("username")
        email = request.form.get("email")
        password = request.form.get("password")
        confirm = request.form.get("confirm_password")
        if not username or not email or not password:
            flash("All fields are required.", "danger")
        elif password != confirm:
            flash("Passwords do not match.", "danger")
        elif User.query.filter_by(username=username).first():
            flash("Username already taken.", "danger")
        elif User.query.filter_by(email=email).first():
            flash("Email already registered.", "danger")
        else:
            user = User(username=username, email=email)
            user.set_password(password)
            if VERIFY_EMAIL and current_app.config.get("MAIL_USERNAME"):
                # Generate verification code
                import random
                user.verification_code = str(random.randint(100000, 999999))
                user.verification_code_expires = datetime.utcnow() + timedelta(minutes=10)
                user.email_verified = False
                db.session.add(user)
                db.session.commit()
                
                try:
                    msg = Message("Your Verification Code", recipients=[user.email], sender=current_app.config.get("MAIL_DEFAULT_SENDER"))
                    msg.body = f"Hello {user.username},\n\nYour verification code is: {user.verification_code}\n\nIt will expire in 10 minutes."
                    mail.send(msg)
                    flash("Account created. A verification code was sent to your email.", "success")
                except Exception as e:
                    print(f"\n{'='*50}\n[LOCAL DEV] FAILED TO SEND EMAIL!\nVerification code for {user.email} is: {user.verification_code}\n{'='*50}\n")
                    flash(f"Account created! (Email sending failed). Your verification code is: {user.verification_code}", "warning")
                    
                return redirect(url_for("auth.verify", user_id=user.id))
            else:
                # Skip verification – mark as verified
                user.email_verified = True
                db.session.add(user)
                db.session.commit()
                login_user(user)
                flash("Account created! You are now logged in.", "success")
                return redirect(url_for("dashboard.dashboard"))
    return render_template("register.html")

@auth_bp.route("/verify/<int:user_id>", methods=["GET", "POST"])
def verify(user_id):
    if not VERIFY_EMAIL:
        return redirect(url_for("auth.login"))
    user = User.query.get_or_404(user_id)
    if user.email_verified:
        return redirect(url_for("auth.login"))
    if request.method == "POST":
        code = request.form.get("code", "").strip()
        if user.verification_code == code and user.verification_code_expires > datetime.utcnow():
            user.email_verified = True
            user.verification_code = None
            user.verification_code_expires = None
            db.session.commit()
            flash("Email verified! You can now log in.", "success")
            return redirect(url_for("auth.login"))
        else:
            flash("Invalid or expired code.", "danger")
    return render_template("verify.html", user=user)

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.dashboard"))
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            if VERIFY_EMAIL and not user.email_verified:
                flash("Please verify your email before logging in.", "warning")
                return redirect(url_for("auth.verify", user_id=user.id))
            login_user(user)
            flash(f"Welcome back, {user.username}!", "success")
            next_page = request.args.get("next")
            return redirect(next_page or url_for("dashboard.dashboard"))
        else:
            flash("Invalid credentials.", "danger")
    return render_template("login.html")

@auth_bp.route("/logout")
def logout():
    logout_user()
    flash("Logged out.", "info")
    return redirect(url_for("auth.index"))

@auth_bp.route('/login/google')
def login_google():
    google = current_app.google
    if not google:
        flash("Google Authentication is not configured. Please set GOOGLE_CLIENT_ID in your environment.", "danger")
        return redirect(url_for('auth.login'))
        
    redirect_uri = url_for('auth.authorized_google', _external=True)
    return google.authorize_redirect(redirect_uri)

@auth_bp.route('/login/google/authorized')
def authorized_google():
    google = current_app.google
    token = google.authorize_access_token()
    user_info = google.get('https://www.googleapis.com/oauth2/v2/userinfo').json()
    email = user_info['email']
    name = user_info.get('name', email.split('@')[0])
    picture = user_info.get('picture', '')
    
    # Check if user exists
    user = User.query.filter_by(email=email).first()
    if user:
        # Update info if needed
        if not user.avatar_url and picture:
            user.avatar_url = picture
        if not user.username:
            user.username = name.replace(' ', '_').lower()
    else:
        # Create new user
        username = name.replace(' ', '_').lower()
        # Ensure unique username
        base_username = username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1
        
        user = User(username=username, email=email, avatar_url=picture, email_verified=True)
        user.set_password('')  # No password for OAuth users
        db.session.add(user)
    
    db.session.commit()
    login_user(user)
    flash(f"Welcome, {user.username}!", "success")
    return redirect(url_for("dashboard.dashboard"))