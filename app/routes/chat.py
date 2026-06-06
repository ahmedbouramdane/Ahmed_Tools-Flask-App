import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

from flask import Blueprint, render_template, redirect, url_for, request, flash, abort, jsonify
from flask_login import login_required, current_user
from app.models import Chat, ChatMessage
from app import db
from app.config import Config
import  google.generativeai as genai

chat_bp = Blueprint('chat', __name__)

genai.configure(api_key=Config.GEMINI_API_KEY)

CANDIDATE_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
]

# System instructions for confident, structured responses
SYSTEM_INSTRUCTIONS = """You are an expert AI assistant with deep knowledge across multiple domains. 
Your responses should be:
- **Confident and authoritative** - Provide clear, direct answers
- **Well-structured** - Use headers (# Main Topic, ## Subtopics), lists, and formatting
- **Comprehensive** - Go into detail when appropriate
- **Practical** - Include examples, code snippets, or actionable steps when relevant
- **Concise yet informative** - Avoid unnecessary verbosity

When responding:
1. Start with a clear summary if the question is complex
2. Use **bold text** to highlight key concepts and important terms
3. Use *italic* for emphasis on terminology
4. Create organized lists (both bullet and numbered) for multiple items
5. Use code blocks with language tags (```python, ```javascript, etc.)
6. Include LaTeX math notation ($$equation$$) for mathematical expressions
7. Add blockquotes for important notes or warnings
8. Break content into clear sections with headers

Your goal is to be the most helpful, knowledgeable, and clear assistant possible."""

def try_generate_with_model(model_name, history, user_message):
    try:
        model = genai.GenerativeModel(
            model_name,
            system_instruction=SYSTEM_INSTRUCTIONS
        )
    except TypeError:
        # Fallback for models that don't support system_instruction
        model = genai.GenerativeModel(model_name)
    
    chat_session = model.start_chat(history=history[:-1])
    response = chat_session.send_message(user_message)
    return response.text.strip()

@chat_bp.route("/chat")
@login_required
def chat_list():
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).all()
    return render_template("chat.html", chats=chats, current_chat=None, messages=[])

@chat_bp.route("/chat/new", methods=["POST"])
@login_required
def new_chat():
    chat = Chat(user_id=current_user.id)
    db.session.add(chat)
    db.session.commit()
    # If request comes from AJAX, return JSON to avoid a full-page redirect
    if request.headers.get("X-Requested-With", "") == "XMLHttpRequest":
        return jsonify({
            "chat_id": chat.id,
            "url": url_for("chat.chat_view", chat_id=chat.id)
        })
    flash("New chat created.", "success")
    return redirect(url_for("chat.chat_view", chat_id=chat.id))

@chat_bp.route("/chat/<int:chat_id>")
@login_required
def chat_view(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).all()
    messages = ChatMessage.query.filter_by(chat_id=chat.id).order_by(ChatMessage.created_at.desc()).limit(6).all()
    messages.reverse()
    return render_template("chat.html", chats=chats, current_chat=chat, messages=messages)

@chat_bp.route("/chat/<int:chat_id>/messages")
@login_required
def chat_messages(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)
    before_id = request.args.get('before', type=int)
    limit = min(request.args.get('limit', 6, type=int), 30)

    q = ChatMessage.query.filter_by(chat_id=chat.id)
    if before_id:
        before_msg = ChatMessage.query.get(before_id)
        if before_msg:
            q = q.filter(ChatMessage.created_at < before_msg.created_at)
    total = q.count()
    messages = q.order_by(ChatMessage.created_at.desc()).limit(limit).all()
    messages.reverse()

    return jsonify({
        'messages': [{
            'id': m.id, 'role': m.role, 'content': m.content,
            'created_at': m.created_at.isoformat()
        } for m in messages],
        'has_more': total > limit
    })


@chat_bp.route("/chat/<int:chat_id>/send", methods=["POST"])
@login_required
def chat_send(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)
    # Accept form-encoded or JSON payloads for flexibility
    if request.is_json:
        payload = request.get_json()
        user_message = (payload.get('message') or '').strip()
    else:
        user_message = (request.form.get("message", "") or '').strip()
    if not user_message:
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({"error": "Message empty"}), 400
        return redirect(url_for("chat.chat_view", chat_id=chat.id))

    # Save user message
    msg_user = ChatMessage(role="user", content=user_message, chat_id=chat.id)
    db.session.add(msg_user)

    # Build history
    history = []
    for m in chat.messages[:-1]:
        role = "user" if m.role == "user" else "model"
        history.append({"role": role, "parts": [m.content]})
    history.append({"role": "user", "parts": [user_message]})

    # AI response (same logic as before)
    ai_text = None
    last_error = None
    for model_name in CANDIDATE_MODELS:
        try:
            ai_text = try_generate_with_model(model_name, history, user_message)
            break
        except Exception as e:
            last_error = str(e)
            if "quota" in str(e).lower() or "429" in str(e) or "404" in str(e):
                continue
    if ai_text is None:
        try:
            available = genai.list_models()
            for m in available:
                if 'generateContent' in getattr(m, 'supported_generation_methods', []):
                    try:
                        ai_text = try_generate_with_model(m.name, history, user_message)
                        break
                    except Exception as fallback_error:
                        last_error = str(fallback_error)
        except Exception as list_err:
            last_error = str(list_err)
    if ai_text is None:
        if last_error and ("quota" in last_error.lower() or "rate limit" in last_error.lower() or "429" in last_error.lower()):
            ai_text = "⚠️ You've reached the free API quota. Please wait and try again."
        else:
            ai_text = f"❌ AI temporarily unavailable. Error: {last_error or 'Unknown error'}"

    msg_ai = ChatMessage(role="assistant", content=ai_text, chat_id=chat.id)
    db.session.add(msg_ai)

    if chat.title == "New Chat":
        try:
            title_model = genai.GenerativeModel("gemini-2.0-flash-lite")
            title_resp = title_model.generate_content(
                f"Summarize this message in 3-5 words as a chat title, be concise, respond only with the title:\n\n{user_message}"
            )
            generated = title_resp.text.strip().strip('"\'')
            if generated:
                chat.title = generated[:60]
            else:
                chat.title = user_message[:50] or "Chat"
        except Exception:
            chat.title = user_message[:50] or "Chat"

    db.session.commit()

    # If AJAX request, return JSON with message details
    if request.headers.get("X-Requested-With", "") == "XMLHttpRequest":
        return jsonify({
            "user_message": {
                "id": msg_user.id,
                "content": msg_user.content,
                "created_at": msg_user.created_at.strftime("%H:%M")
            },
            "ai_message": {
                "id": msg_ai.id,
                "content": msg_ai.content,
                "created_at": msg_ai.created_at.strftime("%H:%M")
            },
            "chat_title": chat.title
        })

    return redirect(url_for("chat.chat_view", chat_id=chat.id))

@chat_bp.route("/chat/<int:chat_id>/delete", methods=["POST"])
@login_required
def chat_delete(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Forbidden'}), 403
        abort(403)
    db.session.delete(chat)
    db.session.commit()
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True})
    flash("Chat deleted.", "info")
    return redirect(url_for("chat.chat_list"))

# --- NEW ROUTES ---

@chat_bp.route("/chat/<int:chat_id>/rename", methods=["POST"])
@login_required
def chat_rename(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        abort(403)
    new_title = request.form.get("title", "").strip()
    if not new_title:
        flash("Chat name cannot be empty.", "danger")
    else:
        chat.title = new_title
        db.session.commit()
        flash("Chat renamed.", "success")
    return redirect(url_for("chat.chat_view", chat_id=chat_id))

@chat_bp.route("/chat/message/<int:msg_id>/delete", methods=["POST"])
@login_required
def message_delete(msg_id):
    msg = ChatMessage.query.get_or_404(msg_id)
    chat = Chat.query.get(msg.chat_id)
    if chat.user_id != current_user.id:
        abort(403)
    db.session.delete(msg)
    db.session.commit()
    return jsonify({"success": True})

