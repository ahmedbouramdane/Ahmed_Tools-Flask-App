from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from app.models import User, Post
from app import db

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

@profile_bp.route("/profile/update", methods=["POST"])
@login_required
def update_profile():
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
        flash("Email is required.", "danger")
        return redirect(url_for("profile.profile"))

    existing_email = User.query.filter(User.email == email, User.id != current_user.id).first()
    if existing_email:
        flash("Email already in use.", "danger")
        return redirect(url_for("profile.profile"))

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
    flash("Profile updated.", "success")
    return redirect(url_for("profile.profile"))

@profile_bp.route("/profile/change-password", methods=["POST"])
@login_required
def change_password():
    old = request.form.get("old_password")
    new = request.form.get("new_password")
    confirm = request.form.get("confirm_password")
    if not current_user.check_password(old):
        flash("Current password incorrect.", "danger")
    elif new != confirm:
        flash("New passwords don't match.", "danger")
    elif len(new) < 6:
        flash("Password too short (min 6 chars).", "danger")
    else:
        current_user.set_password(new)
        db.session.commit()
        flash("Password changed.", "success")
    return redirect(url_for("profile.profile"))

@profile_bp.route("/user/<int:user_id>")
@login_required
def view_profile(user_id):
    user = User.query.get_or_404(user_id)
    return redirect(url_for("posts.user_profile", username=user.username))