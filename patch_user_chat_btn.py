import re

filepath = 'c:/Users/Ahmed_PC/Github_Projects/Ahmed_Tools-Flask-App/templates/user_chat.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = "    const empty = document.getElementById('empty-state'); if(empty) empty.style.display = 'none';\\n    if(window.innerWidth < 1024) toggleUsersSidebar();\\n    document.getElementById('chat-header').classList.remove('hidden');\\n    document.getElementById('chat-header').classList.add('flex');\\n\\n    // Load messages"

replacement = """    const empty = document.getElementById('empty-state'); if(empty) empty.style.display = 'none';
    if(window.innerWidth < 1024) toggleUsersSidebar();
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-header').classList.add('flex');
    
    const profileBtn = document.getElementById('view-profile-btn');
    if (profileBtn) {
      profileBtn.href = `/user/${userId}`;
      profileBtn.classList.remove('hidden');
    }

    // Load messages"""

# If not exact match, let's use regex
content = re.sub(
    r"document\.getElementById\('chat-header'\)\.classList\.add\('flex'\);(.*?)// Load messages",
    r"document.getElementById('chat-header').classList.add('flex');\n    const profileBtn = document.getElementById('view-profile-btn');\n    if (profileBtn) {\n      profileBtn.href = `/user/${userId}`;\n      profileBtn.classList.remove('hidden');\n    }\n\n    // Load messages",
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied")
