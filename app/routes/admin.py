from __future__ import annotations

import os
import uuid
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from app import db
from app.config import Config
from app.models import KnowledgeItem


admin_bp = Blueprint("admin", __name__)


def _require_admin():
    if not getattr(current_user, "is_admin_user", False):
        abort(403)


def _extract_text_from_pdf(file_path: str) -> str:
    # Optional dependency: pypdf
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return ""

    try:
        reader = PdfReader(file_path)
        parts: list[str] = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        text = "\n".join(parts).strip()
        return text
    except Exception:
        return ""


def _extract_text_from_url(url: str) -> str:
    # Keep dependencies minimal: fetch HTML and strip tags roughly.
    req = Request(
        url,
        headers={
            "User-Agent": "AhmedToolsBot/1.0 (+admin-ingestion)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urlopen(req, timeout=15) as resp:  # nosec - admin-only feature
        raw = resp.read()
    html = raw.decode("utf-8", errors="ignore")

    # Try BeautifulSoup if present, otherwise simple stripping.
    try:
        from bs4 import BeautifulSoup  # type: ignore

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.decompose()
        text = soup.get_text("\n", strip=True)
        return text
    except Exception:
        # Naive fallback
        import re

        text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html)
        text = re.sub(r"(?s)<.*?>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text


@admin_bp.route("/admin/knowledge", methods=["GET", "POST"])
@login_required
def knowledge():
    _require_admin()

    if request.method == "POST":
        kind = (request.form.get("kind") or "").strip().lower()
        title = (request.form.get("title") or "").strip()

        if kind == "text":
            content = (request.form.get("content") or "").strip()
            if not content:
                flash("Text content is required.", "danger")
                return redirect(url_for("admin.knowledge"))
            db.session.add(
                KnowledgeItem(
                    kind="text",
                    title=title or "Admin note",
                    content_text=content,
                    created_by_user_id=current_user.id,
                )
            )
            db.session.commit()
            flash("Knowledge item saved.", "success")
            return redirect(url_for("admin.knowledge"))

        if kind == "url":
            url = (request.form.get("url") or "").strip()
            if not url:
                flash("URL is required.", "danger")
                return redirect(url_for("admin.knowledge"))
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                flash("Please provide a valid URL (including https://).", "danger")
                return redirect(url_for("admin.knowledge"))

            text = ""
            try:
                text = _extract_text_from_url(url)
            except Exception:
                text = ""

            db.session.add(
                KnowledgeItem(
                    kind="url",
                    title=title or url,
                    source_url=url,
                    content_text=text,
                    created_by_user_id=current_user.id,
                )
            )
            db.session.commit()
            if not text:
                flash("URL saved, but text extraction failed (content may be protected).", "warning")
            else:
                flash("URL saved and indexed.", "success")
            return redirect(url_for("admin.knowledge"))

        if kind == "pdf":
            if "pdf" not in request.files:
                flash("Please choose a PDF file.", "danger")
                return redirect(url_for("admin.knowledge"))
            f = request.files["pdf"]
            if not f or not f.filename:
                flash("Please choose a PDF file.", "danger")
                return redirect(url_for("admin.knowledge"))

            filename = secure_filename(f.filename)
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext != "pdf":
                flash("Only PDF files are allowed.", "danger")
                return redirect(url_for("admin.knowledge"))

            os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
            unique_name = f"{uuid.uuid4().hex}.pdf"
            abs_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
            f.save(abs_path)

            extracted = _extract_text_from_pdf(abs_path)
            rel_url = f"/static/uploads/{unique_name}"

            db.session.add(
                KnowledgeItem(
                    kind="pdf",
                    title=title or filename,
                    file_path=rel_url,
                    content_text=extracted,
                    created_by_user_id=current_user.id,
                )
            )
            db.session.commit()
            if not extracted:
                flash("PDF uploaded. Text extraction is unavailable (install `pypdf`) or failed.", "warning")
            else:
                flash("PDF uploaded and indexed.", "success")
            return redirect(url_for("admin.knowledge"))

        flash("Invalid knowledge item type.", "danger")
        return redirect(url_for("admin.knowledge"))

    items = KnowledgeItem.query.order_by(KnowledgeItem.created_at.desc()).limit(50).all()
    return render_template("admin_knowledge.html", items=items)


@admin_bp.route("/admin/knowledge/<int:item_id>/delete", methods=["POST"])
@login_required
def knowledge_delete(item_id: int):
    _require_admin()
    item = KnowledgeItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    flash("Knowledge item deleted.", "info")
    return redirect(url_for("admin.knowledge"))

