from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from app import db

settings_bp = Blueprint('settings', __name__)

@settings_bp.route("/settings")
@login_required
def settings():
    return render_template("settings.html")

@settings_bp.route("/settings/save", methods=["POST"])
@login_required
def save_settings():
    full_name = request.form.get("full_name", "").strip()
    reminder = request.form.get("reminder_minutes", type=int)
    sound = request.form.get("notification_sound", "")
    font_family = request.form.get("font_family", "Inter")
    notifications_enabled = request.form.get("notifications_enabled") == "on"
    unread_badge_enabled = request.form.get("unread_badge_enabled") == "on"
    notification_sound_enabled = request.form.get("notification_sound_enabled") == "on"

    if full_name:
        current_user.full_name = full_name
    if reminder and reminder > 0:
        current_user.default_reminder_minutes = reminder
    current_user.notification_sound_url = sound if sound else current_user.notification_sound_url
    current_user.font_family = font_family
    current_user.notifications_enabled = notifications_enabled
    current_user.unread_badge_enabled = unread_badge_enabled
    current_user.notification_sound_enabled = notification_sound_enabled

    db.session.commit()
    flash("Settings saved.", "success")
    return redirect(url_for("settings.settings"))