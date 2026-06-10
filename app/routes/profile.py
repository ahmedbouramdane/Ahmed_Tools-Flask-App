from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_required, current_user
from app.models import User, Post
from app import db
from app.config import Config
import os, uuid
from werkzeug.utils import secure_filename

profile_bp = Blueprint('profile', __name__)

@profile_bp.route("/profile")
@login_required
def profile():
    page = request.args.get('page', 1, type=int)
    posts = Post.query.filter_by(
        user_id=current_user.id
    ).order_by(Post.created_at.desc()).paginate(
        page=page, per_page=10, error_out=False
    )
    return render_template("profile.html", 
                         user=current_user, posts=posts,
                         is_following=False)

def ajax_or_redirect(success, msg, category="success"):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return jsonify({"success": success, "message": msg, "category": category})
    flash(msg, category)
    return redirect(url_for("profile.profile"))

@profile_bp.route("/profile/update", methods=["POST"])
@login_required
def update_profile():
    current_password = request.form.get("current_password", "")
    if not current_user.check_password(current_password):
        return ajax_or_redirect(False, "Current password is incorrect.", "danger")

    full_name = request.form.get("full_name", "").strip()
    email = request.form.get("email")
    bio = request.form.get("bio", "")
    avatar_url = request.form.get("avatar_url", current_user.avatar_url)
    cover_url = request.form.get("cover_url", current_user.cover_url)
    skills_raw = request.form.get("skills", "")

    linkedin = request.form.get("linkedin_url", current_user.linkedin_url)
    github = request.form.get("github_url", current_user.github_url)
    twitter = request.form.get("twitter_url", current_user.twitter_url)
    website = request.form.get("website_url", current_user.website_url)

    if not email:
        return ajax_or_redirect(False, "Email is required.", "danger")

    existing_email = User.query.filter(User.email == email, User.id != current_user.id).first()
    if existing_email:
        return ajax_or_redirect(False, "Email already in use.", "danger")

    current_user.full_name = full_name
    current_user.email = email
    current_user.bio = bio
    current_user.avatar_url = avatar_url
    current_user.cover_url = cover_url
    current_user.skills = skills_raw
    current_user.linkedin_url = linkedin
    current_user.github_url = github
    current_user.twitter_url = twitter
    current_user.website_url = website

    db.session.commit()
    return ajax_or_redirect(True, "Profile updated successfully.", "success")

@profile_bp.route("/profile/change-password", methods=["POST"])
@login_required
def change_password():
    old = request.form.get("old_password")
    new = request.form.get("new_password")
    confirm = request.form.get("confirm_password")
    if not current_user.check_password(old):
        return ajax_or_redirect(False, "Current password is incorrect.", "danger")
    if len(new) < 6:
        return ajax_or_redirect(False, "New password must be at least 6 characters.", "danger")
    if new != confirm:
        return ajax_or_redirect(False, "New passwords do not match.", "danger")
    current_user.set_password(new)
    db.session.commit()
    return ajax_or_redirect(True, "Password changed successfully.", "success")

@profile_bp.route("/user/<int:user_id>")
@login_required
def view_profile(user_id):
    user = User.query.get_or_404(user_id)
    return redirect(url_for("posts.user_profile", username=user.username))

@profile_bp.route("/profile/upload-image", methods=["POST"])
@login_required
def upload_profile_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty file'}), 400
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext not in Config.ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Invalid file type'}), 400
    unique_name = f"profile_{uuid.uuid4().hex}.{ext}"
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
    url = url_for('static', filename=f'uploads/{unique_name}')
    return jsonify({'url': url})