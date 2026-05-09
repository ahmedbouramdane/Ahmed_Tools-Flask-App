import re

filepath = 'c:/Users/Ahmed_PC/Github_Projects/Ahmed_Tools-Flask-App/templates/user_chat.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make container relative
content = content.replace(
    '<div class="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex gap-4">',
    '<div class="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex gap-4 relative overflow-hidden lg:overflow-visible">\n  <div id="user-sidebar-backdrop" class="absolute inset-0 bg-black/50 z-30 hidden lg:hidden rounded-2xl"></div>'
)

# Update sidebar
content = content.replace(
    '<div class="w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col">',
    '<div id="users-sidebar" class="absolute lg:static z-40 h-full w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-xl lg:shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col transform -translate-x-[120%] lg:translate-x-0 transition-transform duration-300">'
)

# Add empty state and toggle buttons
chat_area_start = '<div class="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">'
chat_area_new = """<div class="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col relative">
    <div id="empty-state" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
      <button id="toggle-users-empty" class="absolute top-4 left-4 lg:hidden text-gray-500 hover:text-indigo-600 transition text-xl p-2"><i class="fas fa-users"></i></button>
      <i class="fas fa-users text-6xl mb-4"></i>
      <p class="text-xl">Select a user to start chatting</p>
    </div>
"""
content = content.replace(chat_area_start, chat_area_new)

header_old = """    <div id="chat-header" class="p-4 border-b border-gray-200 dark:border-gray-700 hidden">
      <h4 id="chat-user" class="text-lg font-semibold text-gray-800 dark:text-white"></h4>
    </div>"""
header_new = """    <div id="chat-header" class="p-4 border-b border-gray-200 dark:border-gray-700 hidden flex items-center gap-3">
      <button id="toggle-users-btn" class="lg:hidden text-gray-500 hover:text-indigo-600 transition focus:outline-none p-1">
        <i class="fas fa-bars"></i>
      </button>
      <h4 id="chat-user" class="text-lg font-semibold text-gray-800 dark:text-white"></h4>
    </div>"""
content = content.replace(header_old, header_new)

# Add JS logic for toggling
js_addition = """
  // Mobile sidebar logic
  const usersSidebar = document.getElementById('users-sidebar');
  const userBackdrop = document.getElementById('user-sidebar-backdrop');
  const btn1 = document.getElementById('toggle-users-btn');
  const btn2 = document.getElementById('toggle-users-empty');

  function toggleUsersSidebar() {
    if (window.innerWidth >= 1024) return;
    const isClosed = usersSidebar.classList.contains('-translate-x-[120%]');
    if (isClosed) {
      usersSidebar.classList.remove('-translate-x-[120%]');
      usersSidebar.classList.add('translate-x-0');
      userBackdrop.classList.remove('hidden');
    } else {
      usersSidebar.classList.add('-translate-x-[120%]');
      usersSidebar.classList.remove('translate-x-0');
      userBackdrop.classList.add('hidden');
    }
  }

  btn1?.addEventListener('click', toggleUsersSidebar);
  btn2?.addEventListener('click', toggleUsersSidebar);
  userBackdrop?.addEventListener('click', toggleUsersSidebar);
  
  // On mobile, default to sidebar OPEN if no chat is selected!
  if (window.innerWidth < 1024) {
    usersSidebar.classList.remove('-translate-x-[120%]');
    usersSidebar.classList.add('translate-x-0');
    userBackdrop.classList.remove('hidden');
  }

"""

# Hide empty state on startChat
startChat_old = """    document.getElementById('chat-header').classList.remove('hidden');"""
startChat_new = """    const empty = document.getElementById('empty-state'); if(empty) empty.style.display = 'none';
    if(window.innerWidth < 1024) toggleUsersSidebar();
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-header').classList.add('flex');"""
content = content.replace(startChat_old, startChat_new)

# Add JS addition before loadUsers()
content = content.replace('// Initial load\n  loadUsers();', js_addition + '\n  // Initial load\n  loadUsers();')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied to user_chat.html")
