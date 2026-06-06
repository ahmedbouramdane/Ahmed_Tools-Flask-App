from flask import Blueprint, render_template, request, jsonify, abort, send_file
from flask_login import login_required, current_user
from app import db
import os
import subprocess
import tempfile
import shutil
import json
import time
import re
from pathlib import Path
import threading

ide_bp = Blueprint('ide', __name__)

# Workspace directory for user projects
WORKSPACE_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'workspace')
os.makedirs(WORKSPACE_ROOT, exist_ok=True)

def get_user_workspace():
    """Get the workspace directory for the current user"""
    user_dir = os.path.join(WORKSPACE_ROOT, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    return user_dir

def get_file_path(filename, workspace=None):
    """Get the full file path, ensuring it's within the workspace"""
    if workspace is None:
        workspace = get_user_workspace()
    # Prevent directory traversal attacks
    filepath = os.path.normpath(os.path.join(workspace, filename))
    if not filepath.startswith(os.path.normpath(workspace)):
        raise ValueError("Invalid file path")
    return filepath


@ide_bp.route("/ide")
@login_required
def ide_dashboard():
    """Main IDE page"""
    return render_template('ide/editor.html')


@ide_bp.route("/api/ide/files", methods=["GET"])
@login_required
def list_files():
    """List all files in the user's workspace"""
    workspace = get_user_workspace()
    files = []
    
    for root, dirs, filenames in os.walk(workspace):
        for filename in filenames:
            filepath = os.path.join(root, filename)
            relpath = os.path.relpath(filepath, workspace)
            files.append({
                'name': filename,
                'path': relpath,
                'type': 'file',
                'size': os.path.getsize(filepath)
            })
        # Only go 3 levels deep
        if root.replace(workspace, '').count(os.sep) >= 3:
            dirs.clear()
    
    return jsonify({'files': sorted(files, key=lambda x: x['path'])})


@ide_bp.route("/api/ide/file", methods=["POST"])
@login_required
def save_file():
    """Create or update a file"""
    data = request.get_json()
    filename = data.get('filename', '').strip()
    content = data.get('content', '')
    
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400
    
    try:
        filepath = get_file_path(filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({'success': True, 'path': filename})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ide_bp.route("/api/ide/file", methods=["GET"])
@login_required
def get_file():
    """Get file content"""
    filename = request.args.get('filename', '')
    
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400
    
    try:
        filepath = get_file_path(filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return jsonify({'content': content, 'filename': filename})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ide_bp.route("/api/ide/file", methods=["DELETE"])
@login_required
def delete_file():
    """Delete a file"""
    data = request.get_json()
    filename = data.get('filename', '')
    
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400
    
    try:
        filepath = get_file_path(filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ide_bp.route("/api/ide/folder", methods=["POST"])
@login_required
def create_folder():
    """Create a new folder"""
    data = request.get_json()
    foldername = data.get('foldername', '').strip()
    
    if not foldername:
        return jsonify({'error': 'Folder name is required'}), 400
    
    try:
        folderpath = get_file_path(foldername)
        os.makedirs(folderpath, exist_ok=True)
        return jsonify({'success': True, 'path': foldername})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ide_bp.route("/api/ide/run", methods=["POST"])
@login_required
def run_code():
    """Execute Python code safely in a subprocess"""
    data = request.get_json()
    code = data.get('code', '')
    filename = data.get('filename', 'main.py')
    
    if not code:
        return jsonify({'error': 'Code is required'}), 400
    
    # Create a temporary file for execution
    workspace = get_user_workspace()
    temp_dir = tempfile.mkdtemp(dir=workspace)
    temp_file = os.path.join(temp_dir, filename)
    
    try:
        # Write code to temp file
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(code)
        
        # Execute in a subprocess with timeout and restricted environment
        start_time = time.time()
        
        try:
            result = subprocess.run(
                ['python', temp_file],
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
                cwd=temp_dir,
                env={
                    'PATH': os.environ.get('PATH', ''),
                    'PYTHONPATH': '',
                    'HOME': temp_dir,
                }
            )
            
            elapsed = time.time() - start_time
            
            output = result.stdout
            errors = result.stderr
            return_code = result.returncode
            
        except subprocess.TimeoutExpired:
            output = ''
            errors = 'Error: Execution timed out (30 seconds limit)'
            return_code = -1
        
        return jsonify({
            'success': True,
            'output': output,
            'errors': errors,
            'returnCode': return_code,
            'executionTime': f'{elapsed:.3f}s'
        })
    
    except Exception as e:
        return jsonify({'error': str(e), 'output': '', 'errors': str(e)}), 500
    
    finally:
        # Clean up temp directory
        try:
            shutil.rmtree(temp_dir)
        except:
            pass


@ide_bp.route("/api/ide/lint", methods=["POST"])
@login_required
def lint_code():
    """Basic Python linting"""
    data = request.get_json()
    code = data.get('code', '')
    
    issues = []
    
    # Basic linting rules
    lines = code.split('\n')
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Skip empty lines and comments
        if not stripped or stripped.startswith('#'):
            continue
        
        # Check for common issues
        if len(line) > 100:
            issues.append({
                'line': i,
                'severity': 'warning',
                'message': 'Line too long (>100 characters)'
            })
        
        if '\t' in line:
            issues.append({
                'line': i,
                'severity': 'warning',
                'message': 'Tab character found - use spaces'
            })
        
        if stripped.startswith('import ') and stripped.count('import ') > 1:
            issues.append({
                'line': i,
                'severity': 'info',
                'message': 'Multiple imports on one line'
            })
        
        # Check for undefined variables (very basic)
        if ' = ' in stripped and not stripped.startswith('if ') and not stripped.startswith('for '):
            var_name = stripped.split(' = ')[0].strip()
            if var_name and var_name[0].isdigit():
                issues.append({
                    'line': i,
                    'severity': 'error',
                    'message': 'Variable name cannot start with a digit'
                })
    
    return jsonify({'issues': issues})


@ide_bp.route("/api/ide/format", methods=["POST"])
@login_required
def format_code():
    """Format Python code"""
    data = request.get_json()
    code = data.get('code', '')
    
    try:
        # Try to use autopep8 if available
        import autopep8
        formatted = autopep8.fix_code(code)
        return jsonify({'success': True, 'code': formatted})
    except ImportError:
        # Basic formatting fallback
        lines = code.split('\n')
        formatted_lines = []
        indent_level = 0
        
        for line in lines:
            stripped = line.strip()
            
            # Adjust indent
            if stripped.endswith(':'):
                formatted_lines.append('    ' * indent_level + stripped)
                indent_level += 1
            elif stripped in ['else:', 'elif', 'except:', 'finally:']:
                indent_level = max(0, indent_level - 1)
                formatted_lines.append('    ' * indent_level + stripped)
                indent_level += 1
            else:
                formatted_lines.append('    ' * indent_level + stripped)
                # Simple dedent detection
                if stripped.startswith('return ') or stripped.startswith('break') or stripped.startswith('continue'):
                    pass  # Don't change indent
        
        return jsonify({'success': True, 'code': '\n'.join(formatted_lines)})


@ide_bp.route("/api/ide/snippets", methods=["GET"])
@login_required
def get_snippets():
    """Get code snippets"""
    snippets = [
        {'name': 'Hello World', 'code': 'print("Hello, World!")'},
        {'name': 'For Loop', 'code': 'for i in range(10):\n    print(i)'},
        {'name': 'Function', 'code': 'def greet(name):\n    """Greet someone"""\n    return f"Hello, {name}!"\n\nprint(greet("World"))'},
        {'name': 'Class', 'code': 'class Person:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n    \n    def greet(self):\n        return f"Hi, I\'m {self.name}, {self.age} years old."\n\np = Person("Alice", 30)\nprint(p.greet())'},
        {'name': 'File I/O', 'code': '# Read a file\nwith open("example.txt", "r") as f:\n    content = f.read()\n    print(content)\n\n# Write to a file\nwith open("output.txt", "w") as f:\n    f.write("Hello, File!")'},
        {'name': 'List Comprehension', 'code': '# Create a list of squares\nsquares = [x**2 for x in range(10)]\nprint(squares)\n\n# Filter even numbers\nevens = [x for x in range(20) if x % 2 == 0]\nprint(evens)'},
        {'name': 'Error Handling', 'code': 'try:\n    result = 10 / 0\nexcept ZeroDivisionError as e:\n    print(f"Error: {e}")\nfinally:\n    print("Done")'},
        {'name': 'Dictionary', 'code': 'person = {\n    "name": "Alice",\n    "age": 30,\n    "city": "New York"\n}\n\nfor key, value in person.items():\n    print(f"{key}: {value}")'},
        {'name': 'Lambda', 'code': '# Simple lambda\nsquare = lambda x: x ** 2\nprint(square(5))\n\n# Lambda with map\nnumbers = [1, 2, 3, 4, 5]\nsquared = list(map(lambda x: x**2, numbers))\nprint(squared)'},
        {'name': 'API Request', 'code': 'import requests\n\n# Make a GET request\nresponse = requests.get("https://api.example.com/data")\n\nif response.status_code == 200:\n    data = response.json()\n    print(data)\nelse:\n    print(f"Error: {response.status_code}")'},
    ]
    return jsonify({'snippets': snippets})


@ide_bp.route("/api/ide/autocomplete", methods=["POST"])
@login_required
def autocomplete():
    """Basic Python keyword autocomplete"""
    data = request.get_json()
    current_word = data.get('word', '').lower()
    
    keywords = [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
        'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
        'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
        'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try',
        'while', 'with', 'yield', 'print', 'input', 'range', 'len', 'str',
        'int', 'float', 'list', 'dict', 'set', 'tuple', 'type', 'isinstance',
        'open', 'file', 'read', 'write', 'append', 'split', 'join', 'strip',
        'format', 'replace', 'upper', 'lower', 'find', 'count', 'sort',
        'sorted', 'min', 'max', 'sum', 'abs', 'round', 'pow', 'zip',
        'enumerate', 'map', 'filter', 'reduce', 'any', 'all', 'hasattr',
        'getattr', 'setattr', 'delattr', 'callable', 'iter', 'next',
        'super', 'object', 'property', 'staticmethod', 'classmethod'
    ]
    
    suggestions = [kw for kw in keywords if kw.startswith(current_word)]
    return jsonify({'suggestions': suggestions[:10]})