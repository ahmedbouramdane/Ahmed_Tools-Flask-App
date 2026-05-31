import os
import sys
import subprocess
import threading
import signal
from flask import request
from flask_socketio import Namespace, emit

_terminals = {}

class TerminalNamespace(Namespace):
    def on_connect(self):
        from flask import current_app
        sid = request.sid
        if sid in _terminals:
            return
        if os.name == 'nt':
            shell_cmd = ['cmd.exe', '/q']
        else:
            shell = os.environ.get('SHELL', '/bin/bash')
            shell_cmd = [shell, '-i']
        try:
            cwd = os.path.expanduser('~')
            proc = subprocess.Popen(
                shell_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0,
                cwd=cwd,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            session = {'process': proc, 'alive': True, 'sid': sid}
            _terminals[sid] = session
            app = current_app._get_current_object()
            t = threading.Thread(target=_read_output, args=(sid, app), daemon=True)
            session['thread'] = t
            t.start()
        except Exception as e:
            emit('terminal:output', {'data': f'\r\n[Failed to start shell: {e}]\r\n'})

    def on_terminal_input(self, data):
        sid = request.sid
        session = _terminals.get(sid)
        if session and session['alive']:
            try:
                session['process'].stdin.write(data.encode())
                session['process'].stdin.flush()
            except:
                pass

    def on_terminal_resize(self, data):
        pass

    def on_disconnect(self):
        sid = request.sid
        _kill_session(sid)


def _read_output(sid, app):
    with app.app_context():
        sio = app.socketio
        session = _terminals.get(sid)
        if not session:
            return
        proc = session['process']
        try:
            while session['alive']:
                chunk = proc.stdout.read(4096)
                if not chunk:
                    break
                decoded = chunk.decode('utf-8', errors='replace')
                try:
                    sio.emit('terminal:output', {'data': decoded}, room=sid, namespace='/terminal')
                except:
                    break
        except:
            pass
        finally:
            session['alive'] = False
            try:
                sio.emit('terminal:output', {'data': '\r\n[Process exited]\r\n'}, room=sid, namespace='/terminal')
            except:
                pass


def _kill_session(sid):
    session = _terminals.pop(sid, None)
    if not session:
        return
    session['alive'] = False
    try:
        proc = session['process']
        if os.name == 'nt':
            proc.send_signal(signal.CTRL_BREAK_EVENT)
            try:
                proc.wait(timeout=3)
            except:
                proc.kill()
                proc.wait(timeout=2)
        else:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except:
                proc.kill()
                proc.wait(timeout=2)
    except:
        try:
            session['process'].kill()
        except:
            pass
