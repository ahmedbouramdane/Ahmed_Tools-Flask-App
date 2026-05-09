import os, io, uuid, random, string, base64, json, hashlib, re
from flask import Blueprint, render_template, request, jsonify, send_file
from flask_login import login_required
from app.config import Config
import google.generativeai as genai

tools_bp = Blueprint("tools", __name__)

UPLOAD_FOLDER = Config.UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── Gemini Helper ──────────────────────────────────────────────────────────

def gemini_response(prompt):
    key = Config.GEMINI_API_KEY
    if not key:
        return "Gemini API key not configured"
    genai.configure(api_key=key)
    models_to_try = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-001"]
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            return resp.text
        except Exception:
            continue
    return "AI service unavailable"

# ─── Main SPA Page ──────────────────────────────────────────────────────────

@tools_bp.route("/tools")
@login_required
def tools_page():
    return render_template("tools.html")

# ═══════════════════════════════════════════════════════════════════════════
#  🖼️ IMAGE TOOLS
# ═══════════════════════════════════════════════════════════════════════════

def process_image(file, operation, params):
    from PIL import Image, ImageEnhance, ImageFilter as PILFilter
    img = Image.open(io.BytesIO(file.read()))
    original_format = img.format or 'PNG'

    if operation == 'compress':
        quality = int(params.get('quality', 70))
        buf = io.BytesIO()
        img.save(buf, format='JPEG' if img.mode == 'RGB' else 'PNG', quality=quality, optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"success": True, "image": f"data:image/{'jpeg' if img.mode == 'RGB' else 'png'};base64,{b64}", "size": len(buf.getvalue())}

    if operation == 'resize':
        w = int(params.get('width', 800))
        h = int(params.get('height', 600))
        keep_ratio = params.get('keep_ratio', 'true') == 'true'
        if keep_ratio:
            img.thumbnail((w, h), Image.LANCZOS)
        else:
            img = img.resize((w, h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format=original_format)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"success": True, "image": f"data:image/{original_format.lower()};base64,{b64}", "size": len(buf.getvalue())}

    if operation == 'enhance':
        scale = float(params.get('scale', 2))
        w = int(img.width * scale)
        h = int(img.height * scale)
        img = img.resize((w, h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format=original_format, quality=95)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"success": True, "image": f"data:image/{original_format.lower()};base64,{b64}", "size": len(buf.getvalue())}

    if operation == 'filters':
        filter_type = params.get('filter', 'grayscale')
        if filter_type == 'grayscale':
            img = img.convert('L').convert('RGB')
        elif filter_type == 'sepia':
            gray = img.convert('L')
            w, h = img.size
            sepia = Image.new('RGB', (w, h))
            for x in range(w):
                for y in range(h):
                    g = gray.getpixel((x, y))
                    sepia.putpixel((x, y), (min(int(g * 1.2), 255), min(int(g * 1.0), 255), min(int(g * 0.8), 255)))
            img = sepia
        elif filter_type == 'blur':
            img = img.filter(PILFilter.BLUR)
        elif filter_type == 'sharpen':
            img = img.filter(PILFilter.SHARPEN)
        elif filter_type == 'edge':
            img = img.filter(PILFilter.FIND_EDGES)
        elif filter_type == 'emboss':
            img = img.filter(PILFilter.EMBOSS)
        elif filter_type == 'smooth':
            img = img.filter(PILFilter.SMOOTH)
        elif filter_type == 'contrast':
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.5)
        elif filter_type == 'brightness':
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.3)
        buf = io.BytesIO()
        img.save(buf, format=original_format)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"success": True, "image": f"data:image/{original_format.lower()};base64,{b64}", "size": len(buf.getvalue())}

    if operation == 'crop':
        left = int(params.get('left', 0))
        top = int(params.get('top', 0))
        right = int(params.get('right', img.width))
        bottom = int(params.get('bottom', img.height))
        img = img.crop((left, top, right, bottom))
        buf = io.BytesIO()
        img.save(buf, format=original_format)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"success": True, "image": f"data:image/{original_format.lower()};base64,{b64}", "size": len(buf.getvalue())}

    if operation == 'to_pdf':
        buf = io.BytesIO()
        img.convert('RGB').save(buf, format='PDF')
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"success": True, "file": f"data:application/pdf;base64,{b64}", "size": len(buf.getvalue())}

    if operation == 'remove_bg':
        from rembg import remove
        file.seek(0)
        output = remove(file.read())
        b64 = base64.b64encode(output).decode()
        return {"success": True, "image": f"data:image/png;base64,{b64}", "size": len(output)}

    if operation == 'convert':
        fmt = params.get('format', 'png').lower()
        img = img.convert('RGB') if fmt == 'jpeg' and img.mode in ('RGBA', 'P') else img
        buf = io.BytesIO()
        img.save(buf, format=fmt.upper(), quality=int(params.get('quality', 90)))
        b64 = base64.b64encode(buf.getvalue()).decode()
        mime = 'jpeg' if fmt == 'jpg' else fmt
        return {"success": True, "image": f"data:image/{mime};base64,{b64}", "format": fmt, "size": len(buf.getvalue())}

    return {"error": "Unknown operation"}

@tools_bp.route("/tools/api/image/<operation>", methods=["POST"])
@login_required
def image_tool(operation):
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Empty file"}), 400
    try:
        result = process_image(file, operation, request.form)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════════
#  📄 PDF TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@tools_bp.route("/tools/api/pdf/merge", methods=["POST"])
@login_required
def pdf_merge():
    from PyPDF2 import PdfMerger
    files = request.files.getlist('files')
    if len(files) < 2:
        return jsonify({"error": "Need at least 2 PDFs"}), 400
    merger = PdfMerger()
    for f in files:
        merger.append(f)
    buf = io.BytesIO()
    merger.write(buf)
    merger.close()
    b64 = base64.b64encode(buf.getvalue()).decode()
    return jsonify({"success": True, "file": f"data:application/pdf;base64,{b64}", "size": len(buf.getvalue())})

@tools_bp.route("/tools/api/pdf/split", methods=["POST"])
@login_required
def pdf_split():
    from PyPDF2 import PdfReader, PdfWriter
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    reader = PdfReader(file)
    pages = []
    for i, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        pages.append({"page": i + 1, "data": base64.b64encode(buf.getvalue()).decode()})
    return jsonify({"success": True, "pages": pages, "total": len(pages)})

@tools_bp.route("/tools/api/pdf/protect", methods=["POST"])
@login_required
def pdf_protect():
    from PyPDF2 import PdfReader, PdfWriter
    password = request.form.get('password', '')
    if not password:
        return jsonify({"error": "Password required"}), 400
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    reader = PdfReader(request.files['file'])
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)
    buf = io.BytesIO()
    writer.write(buf)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return jsonify({"success": True, "file": f"data:application/pdf;base64,{b64}", "size": len(buf.getvalue())})

@tools_bp.route("/tools/api/pdf/unlock", methods=["POST"])
@login_required
def pdf_unlock():
    from PyPDF2 import PdfReader, PdfWriter
    password = request.form.get('password', '')
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    try:
        reader = PdfReader(request.files['file'])
        if reader.is_encrypted:
            reader.decrypt(password)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return jsonify({"success": True, "file": f"data:application/pdf;base64,{b64}", "size": len(buf.getvalue())})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@tools_bp.route("/tools/api/pdf/watermark", methods=["POST"])
@login_required
def pdf_watermark():
    from PyPDF2 import PdfReader, PdfWriter
    text = request.form.get('text', '')
    if 'file' not in request.files or not text:
        return jsonify({"error": "File and text required"}), 400
    try:
        reader = PdfReader(request.files['file'])
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return jsonify({"success": True, "file": f"data:application/pdf;base64,{b64}", "size": len(buf.getvalue())})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════════
#  🤖 AI TOOLS (Gemini)
# ═══════════════════════════════════════════════════════════════════════════

@tools_bp.route("/tools/api/ai/<operation>", methods=["POST"])
@login_required
def ai_tool(operation):
    data = request.json or request.form
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "Text required"}), 400

    prompts = {
        "summarize": f"Summarize the following text concisively in 3-5 sentences:\n\n{text}",
        "translate": f"Translate the following text{' from '+data.get('source','auto') if data.get('source') and data.get('source')!='auto' else ''} to {data.get('language', 'English')}.{' Use '+data.get('style','standard')+' language.' if data.get('style') and data.get('style')!='standard' else ''} Only return the translation:\n\n{text}",
        "keywords": f"Extract 5-10 key keywords from this text. Return as a comma-separated list:\n\n{text}",
        "rewrite": f"Rewrite the following text to be clearer and more professional:\n\n{text}",
        "caption": f"Generate 3 social media captions for this text:\n\n{text}",
        "grammar": f"Fix any grammar and spelling errors in this text. Only return the corrected version:\n\n{text}",
    }
    prompt = prompts.get(operation)
    if not prompt:
        return jsonify({"error": "Unknown operation"}), 400
    try:
        result = gemini_response(prompt)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════════
#  🔗 URL SHORTENER (via is.gd)
# ═══════════════════════════════════════════════════════════════════════════

@tools_bp.route("/tools/api/url/shorten", methods=["POST"])
@login_required
def url_shorten():
    import urllib.request, urllib.parse
    data = request.json or request.form
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL required"}), 400
    try:
        params = urllib.parse.urlencode({"format": "json", "url": url})
        with urllib.request.urlopen(f"https://is.gd/create.php?{params}", timeout=10) as resp:
            result = json.loads(resp.read())
            if "shorturl" in result:
                return jsonify({"success": True, "short_url": result["shorturl"]})
            return jsonify({"error": result.get("errormessage", "Failed")}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════════
#  🔐 SECURITY TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@tools_bp.route("/tools/api/security/password", methods=["POST"])
@login_required
def password_generator_api():
    data = request.json or request.form
    length = min(int(data.get("length", 16)), 128)
    use_upper = data.get("use_upper", "true") in ("true", "on", "1")
    use_lower = data.get("use_lower", "true") in ("true", "on", "1")
    use_digits = data.get("use_digits", "true") in ("true", "on", "1")
    use_symbols = data.get("use_symbols", "true") in ("true", "on", "1")
    exclude = data.get("exclude", "")
    count = min(int(data.get("count", 1)), 20)
    chars = ""
    if use_upper: chars += string.ascii_uppercase
    if use_lower: chars += string.ascii_lowercase
    if use_digits: chars += string.digits
    if use_symbols: chars += "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not chars: return jsonify({"error": "Select at least one type"}), 400
    for c in exclude: chars = chars.replace(c, "")
    if not chars: return jsonify({"error": "All chars excluded"}), 400
    passwords = ["".join(random.choice(chars) for _ in range(length)) for _ in range(count)]
    return jsonify({"success": True, "passwords": passwords})

@tools_bp.route("/tools/api/security/check-password", methods=["POST"])
@login_required
def check_password():
    data = request.json or request.form
    pwd = data.get("password", "")
    score = 0
    if len(pwd) >= 8: score += 1
    if len(pwd) >= 12: score += 1
    if re.search(r'[A-Z]', pwd): score += 1
    if re.search(r'[a-z]', pwd): score += 1
    if re.search(r'\d', pwd): score += 1
    if re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]', pwd): score += 1
    if score <= 2: level = "Weak"
    elif score <= 4: level = "Medium"
    else: level = "Strong"
    return jsonify({"score": score, "max": 6, "level": level, "length": len(pwd)})

@tools_bp.route("/tools/api/security/encrypt", methods=["POST"])
@login_required
def encrypt_text():
    data = request.json or request.form
    text = data.get("text", "")
    if not text: return jsonify({"error": "Text required"}), 400
    b64 = base64.b64encode(text.encode()).decode()
    return jsonify({"success": True, "result": b64})

@tools_bp.route("/tools/api/security/decrypt", methods=["POST"])
@login_required
def decrypt_text():
    data = request.json or request.form
    text = data.get("text", "")
    if not text: return jsonify({"error": "Text required"}), 400
    try:
        decoded = base64.b64decode(text).decode()
        return jsonify({"success": True, "result": decoded})
    except Exception as e:
        return jsonify({"error": "Invalid base64"}), 400

@tools_bp.route("/tools/api/security/hash", methods=["POST"])
@login_required
def hash_text():
    data = request.json or request.form
    text = data.get("text", "").encode()
    algo = data.get("algorithm", "sha256")
    algos = {
        "md5": hashlib.md5, "sha1": hashlib.sha1,
        "sha256": hashlib.sha256, "sha512": hashlib.sha512
    }
    h = algos.get(algo, hashlib.sha256)(text).hexdigest()
    return jsonify({"success": True, "result": h, "algorithm": algo})

# ═══════════════════════════════════════════════════════════════════════════
#  🔗 WEB DEV TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@tools_bp.route("/tools/api/json/validate", methods=["POST"])
@login_required
def json_validate():
    data = request.json or request.form
    text = data.get("text", "")
    try:
        parsed = json.loads(text)
        formatted = json.dumps(parsed, indent=2)
        return jsonify({"success": True, "valid": True, "formatted": formatted})
    except json.JSONDecodeError as e:
        return jsonify({"success": True, "valid": False, "error": str(e)})

@tools_bp.route("/tools/api/qr", methods=["POST"])
@login_required
def qr_generator_api():
    import qrcode
    data = request.json or request.form
    text = data.get("text", "").strip()
    if not text: return jsonify({"error": "Text required"}), 400
    fill = data.get("fill_color", "#000000")
    back = data.get("back_color", "#FFFFFF")
    box = int(data.get("box_size", 10))
    qr = qrcode.QRCode(box_size=box, border=2)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill, back_color=back)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return jsonify({"success": True, "image": f"data:image/png;base64,{b64}", "size": len(buf.getvalue())})

# ═══════════════════════════════════════════════════════════════════════════
#  💻 DEVELOPER TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@tools_bp.route("/tools/api/dev/compile", methods=["POST"])
@login_required
def dev_compile():
    import subprocess, tempfile, os, sys
    data = request.json or request.form
    lang = data.get("language", "").strip().lower()
    code = data.get("code", "")
    if not code:
        return jsonify({"error": "Code required"}), 400

    try:
        if lang == "sass":
            try:
                import sass as libsass
                result = libsass.compile(string=code, output_style='expanded')
                return jsonify({"success": True, "result": result, "language": "css"})
            except ImportError:
                return jsonify({"error": "Sass compiler not available. Install: pip install libsass"}), 400

        elif lang == "less":
            try:
                import lesscpy
                result = lesscpy.compile(code)
                return jsonify({"success": True, "result": result, "language": "css"})
            except ImportError:
                return jsonify({"error": "Less compiler not available. Install: pip install lesscpy"}), 400

        elif lang == "pug":
            try:
                import pypugjs
                from pypugjs import simple
                result = simple.convert(code)
                return jsonify({"success": True, "result": result, "language": "html"})
            except ImportError:
                return jsonify({"error": "Pug compiler not available. Install: pip install pypugjs"}), 400

        elif lang == "coffeescript":
            try:
                with tempfile.NamedTemporaryFile(suffix='.coffee', mode='w', delete=False, encoding='utf-8') as f:
                    f.write(code)
                    f.flush()
                    fname = f.name
                result = subprocess.run(
                    [sys.executable, '-m', 'coffeescript', fname],
                    capture_output=True, text=True, timeout=15
                )
                os.unlink(fname)
                if result.returncode == 0:
                    return jsonify({"success": True, "result": result.stdout.strip(), "language": "javascript"})
                return jsonify({"error": result.stderr.strip() or "Compilation failed"}), 400
            except FileNotFoundError:
                return jsonify({"error": "CoffeeScript not available. Install: pip install CoffeeScript"}), 400

        elif lang == "typescript":
            try:
                with tempfile.NamedTemporaryFile(suffix='.ts', mode='w', delete=False, encoding='utf-8') as f:
                    f.write(code)
                    f.flush()
                    fname = f.name
                outname = fname.replace('.ts', '.js')
                result = subprocess.run(
                    ['npx', '--yes', 'typescript', '--outFile', outname, fname],
                    capture_output=True, text=True, timeout=30
                )
                if os.path.exists(outname):
                    with open(outname, 'r', encoding='utf-8') as f:
                        out = f.read()
                    os.unlink(outname)
                    os.unlink(fname)
                    return jsonify({"success": True, "result": out, "language": "javascript"})
                os.unlink(fname)
                return jsonify({"error": result.stderr.strip() or "Compilation failed"}), 400
            except Exception:
                return jsonify({"error": "TypeScript compiler not available. Install Node.js and npm"}), 400

        elif lang == "jsx":
            try:
                with tempfile.NamedTemporaryFile(suffix='.jsx', mode='w', delete=False, encoding='utf-8') as f:
                    f.write(code)
                    f.flush()
                    fname = f.name
                result = subprocess.run(
                    ['npx', '--yes', '@babel/cli', fname, '--presets=@babel/preset-react'],
                    capture_output=True, text=True, timeout=30
                )
                os.unlink(fname)
                if result.returncode == 0:
                    return jsonify({"success": True, "result": result.stdout.strip(), "language": "javascript"})
                return jsonify({"error": result.stderr.strip() or "Compilation failed"}), 400
            except Exception:
                return jsonify({"error": "Babel/JSX compiler not available. Install Node.js and npm"}), 400

        else:
            return jsonify({"error": f"Unknown language: {lang}"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500
