from flask import Blueprint, render_template, redirect, url_for, request, flash, abort, jsonify
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from app.models import Note
from app import db
from app.config import Config
import os, uuid

notes_bp = Blueprint('notes', __name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@notes_bp.route("/notes")
@login_required
def notes():
    search = request.args.get("search", "")
    query = Note.query.filter_by(user_id=current_user.id)
    if search:
        query = query.filter(Note.title.ilike(f"%{search}%"))
    notes_list = query.order_by(Note.updated_at.desc()).all()
    return render_template("notes.html", notes=notes_list, search=search)

@notes_bp.route("/notes/add", methods=["POST"])
@login_required
def add_note():
    title = request.form.get("title")
    if not title:
        flash("Title required.", "danger")
        return redirect(url_for("notes.notes"))
    note = Note(title=title, content='', user_id=current_user.id)
    db.session.add(note)
    db.session.commit()
    flash("Note created. Click Edit to design it.", "success")
    return redirect(url_for("notes.edit_note", note_id=note.id))

@notes_bp.route("/notes/edit/<int:note_id>", methods=["GET", "POST"])
@login_required
def edit_note(note_id):
    note = Note.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        abort(403)
    if request.method == "POST":
        title = request.form.get("title")
        content = request.form.get("content")
        if not title:
            flash("Title required.", "danger")
            return redirect(url_for("notes.edit_note", note_id=note.id))
        note.title = title
        note.content = content if content else ''
        db.session.commit()
        flash("Note updated.", "success")
        return redirect(url_for("notes.notes"))
    return render_template("edit_note.html", note=note)

@notes_bp.route("/notes/delete/<int:note_id>", methods=["POST"])
@login_required
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        abort(403)
    db.session.delete(note)
    db.session.commit()
    flash("Note deleted.", "info")
    return redirect(url_for("notes.notes"))

@notes_bp.route("/notes/upload-image", methods=["POST"])
@login_required
def upload_note_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty file'}), 400
    if file and allowed_file(file.filename):
        original = secure_filename(file.filename)
        ext = original.rsplit('.', 1)[1].lower()
        unique_name = f"note_{uuid.uuid4().hex}.{ext}"
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
        from flask import url_for as flask_url_for
        return jsonify({'url': flask_url_for('static', filename=f'uploads/{unique_name}')})
    return jsonify({'error': 'Invalid file type'}), 400