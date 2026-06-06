import re
from urllib.parse import urljoin, urlparse
from flask import Blueprint, render_template, redirect, url_for, request, flash, session, current_app
from flask_login import current_user, login_user, logout_user
from app.models import User
from app import db, mail
from flask_mail import Message
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)


def is_safe_url(target):
    host_url = request.host_url
    redirect_url = urljoin(host_url, target)
    return urlparse(redirect_url).scheme in ('http', 'https') and urlparse(host_url).netloc == urlparse(redirect_url).netloc

VERIFY_EMAIL = True   # Enable email verification


def sanitize_username(full_name):
    s = full_name.strip().lower()
    s = re.sub(r'\s+', '_', s)
    s = re.sub(r'[^a-z0-9_]', '', s)
    s = re.sub(r'_+', '_', s).strip('_')
    if not s or not s[0].isalpha():
        s = 'user_' + (s if s else '')
    return s[:30]


def generate_unique_username(full_name):
    base = sanitize_username(full_name)
    if not base:
        base = 'user'
    if not User.query.filter_by(username=base).first():
        return base
    counter = 1
    while True:
        candidate = f"{base}{counter}"
        if not User.query.filter_by(username=candidate).first():
            return candidate
        counter += 1


USERNAME_PATTERN = re.compile(r'^[a-z][a-z0-9_]{2,29}$')

def validate_username(username):
    if not USERNAME_PATTERN.match(username):
        return False
    return True


def send_verification_email_async(app, email, code, name):
    with app.app_context():
        try:
            msg = Message("Your Verification Code", recipients=[email], sender=app.config.get("MAIL_DEFAULT_SENDER"))
            msg.body = f"Hello {name},\n\nYour verification code is: {code}\n\nIt will expire in 10 minutes."
            mail.send(msg)
            app.logger.info(f"Verification email sent to {email}")
        except Exception as e:
            app.logger.error(f"Failed to send verification email to {email}: {e}")

def send_verification_code(user):
    import random, threading
    code = f"{random.randint(0, 999999):06d}"
    user.verification_code = code
    user.verification_code_expires = datetime.utcnow() + timedelta(minutes=10)
    user.email_verified = False
    db.session.commit()

    if current_app.config.get("MAIL_USERNAME"):
        app = current_app._get_current_object()
        t = threading.Thread(target=send_verification_email_async, args=(app, user.email, code, user.username or user.full_name))
        t.daemon = True
        t.start()
        return {"sent": True, "code": code, "error": None}
    else:
        return {"sent": False, "code": code, "error": "Email not configured"}

@auth_bp.route("/")
def index():
    if current_user.is_authenticated and current_user.email_verified:
        return redirect(url_for("dashboard.dashboard"))
    return render_template("index.html", google_enabled=bool(current_app.google))

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.dashboard"))
    next_page = request.args.get("next")
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        username = request.form.get("username", "").strip().lower()
        email = request.form.get("email")
        password = request.form.get("password")
        confirm = request.form.get("confirm_password")
        next_page = request.form.get("next") or next_page

        if not full_name or not email or not password:
            flash("Full name, email, and password are required.", "danger")
        elif password != confirm:
            flash("Passwords do not match.", "danger")
        elif not username:
            flash("Username is required.", "danger")
        elif not validate_username(username):
            flash("Username must start with a letter and contain only lowercase letters, numbers, and underscores (3-30 chars).", "danger")
        elif User.query.filter_by(username=username).first():
            flash("Username already taken.", "danger")
        elif User.query.filter_by(email=email).first():
            flash("Email already registered.", "danger")
        else:
            user = User(username=username, full_name=full_name, email=email)
            user.set_password(password)
            if VERIFY_EMAIL:
                db.session.add(user)
                db.session.commit()
                result = send_verification_code(user)
                session['verify_email_sent'] = result["sent"]
                session['verify_code'] = result["code"]
                return redirect(url_for("auth.verify", user_id=user.id))
            else:
                user.email_verified = True
                db.session.add(user)
                db.session.commit()
                login_user(user)
                flash("Account created! You are now logged in.", "success")
                if next_page and is_safe_url(next_page):
                    return redirect(next_page)
                return redirect(url_for("dashboard.dashboard"))
    return render_template("register.html", next_page=next_page, google_enabled=bool(current_app.google))

@auth_bp.route("/verify/<int:user_id>", methods=["GET", "POST"])
def verify(user_id):
    if not VERIFY_EMAIL:
        return redirect(url_for("auth.login"))
    user = User.query.get_or_404(user_id)
    if user.email_verified:
        return redirect(url_for("auth.login"))
    
    dev_code = session.pop('verify_code', None)
    session.pop('verify_email_sent', None)
    
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
    
    return render_template("verify.html", user=user, dev_code=dev_code)

@auth_bp.route("/api/verify/<int:user_id>/resend", methods=["POST"])
def resend_verification(user_id):
    if not VERIFY_EMAIL:
        return {"error": "Verification disabled"}, 400
    user = User.query.get_or_404(user_id)
    if user.email_verified:
        return {"error": "Email already verified", "redirect": url_for("auth.login")}, 400
    result = send_verification_code(user)
    return {"sent": result["sent"], "code": result["code"], "message": "Verification code sent to your email." if result["sent"] else "Could not send email.", "error": result.get("error")}

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.dashboard"))
    next_page = request.args.get("next")
    if request.method == "POST":
        credential = request.form.get("username", "").strip()
        password = request.form.get("password")
        next_page = request.form.get("next") or next_page
        
        is_json = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        if not credential or not password:
            msg = "Please enter both email/username and password."
            if is_json:
                return {"success": False, "error": msg}, 400
            flash(msg, "danger")
        else:
            user = User.query.filter(
                (User.email == credential) | (User.username == credential)
            ).first()
            if user and user.check_password(password):
                if VERIFY_EMAIL and not user.email_verified:
                    msg = "Please verify your email before logging in."
                    verify_url = url_for("auth.verify", user_id=user.id)
                    if is_json:
                        return {"success": False, "redirect": verify_url, "error": msg}
                    flash(msg, "warning")
                    return redirect(verify_url)
                login_user(user)
                display_name = user.full_name or user.username
                target = next_page if next_page and is_safe_url(next_page) else url_for("dashboard.dashboard")
                if is_json:
                    return {"success": True, "redirect": target, "name": display_name}
                flash(f"Welcome back, {display_name}!", "success")
                return redirect(target)
            else:
                if is_json:
                    return {"success": False, "error": "Invalid credentials."}, 401
                flash("Invalid credentials.", "danger")
    return render_template("login.html", next_page=next_page, google_enabled=bool(current_app.google))

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

    user = User.query.filter_by(email=email).first()
    if user:
        if not user.avatar_url and picture:
            user.avatar_url = picture
        if not user.full_name:
            user.full_name = name
    else:
        username = generate_unique_username(name)
        user = User(username=username, full_name=name, email=email, avatar_url=picture, email_verified=True)
        user.set_password('')
        db.session.add(user)

    db.session.commit()
    login_user(user)
    display_name = user.full_name or user.username
    flash(f"Welcome, {display_name}!", "success")
    return redirect(url_for("dashboard.dashboard"))