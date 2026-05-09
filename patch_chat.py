import re

filepath = 'c:/Users/Ahmed_PC/Github_Projects/Ahmed_Tools-Flask-App/templates/chat.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Make container relative and handle overflow on mobile
content = content.replace(
    '<div class="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex gap-4" id="chat-container">',
    '<div class="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex gap-4 relative overflow-hidden lg:overflow-visible" id="chat-container">\n  <div id="chat-sidebar-backdrop" class="absolute inset-0 bg-black/50 z-30 hidden lg:hidden rounded-2xl"></div>'
)

# Update chat sidebar classes for mobile sliding
content = content.replace(
    '<div id="chat-sidebar" class="w-72 flex-shrink-0 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col overflow-y-auto relative" style="width: 280px;">',
    '<div id="chat-sidebar" class="absolute lg:static z-40 h-full w-72 flex-shrink-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl lg:shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col overflow-y-auto relative transform -translate-x-[120%] lg:translate-x-0 transition-transform duration-300" style="width: 280px;">'
)

# In JS, update applyChatSidebarState
js_old = """  function applyChatSidebarState() {
    if (chatSidebarVisible) {
      chatSidebar.classList.remove('collapsed');
      chatSidebar.style.width = localStorage.getItem('chatSidebarWidth') || '280px';
    } else {
      chatSidebar.classList.add('collapsed');
      chatSidebar.style.width = '80px';
    }
  }"""

js_new = """  const chatBackdrop = document.getElementById('chat-sidebar-backdrop');
  function applyChatSidebarState() {
    if (window.innerWidth < 1024) {
      // Mobile logic
      chatSidebar.classList.remove('collapsed');
      chatSidebar.style.width = '280px';
      if (chatSidebarVisible) {
        chatSidebar.classList.remove('-translate-x-[120%]');
        chatSidebar.classList.add('translate-x-0');
        chatBackdrop?.classList.remove('hidden');
      } else {
        chatSidebar.classList.add('-translate-x-[120%]');
        chatSidebar.classList.remove('translate-x-0');
        chatBackdrop?.classList.add('hidden');
      }
    } else {
      // Desktop logic
      chatSidebar.classList.remove('-translate-x-[120%]', 'translate-x-0');
      chatBackdrop?.classList.add('hidden');
      if (chatSidebarVisible) {
        chatSidebar.classList.remove('collapsed');
        chatSidebar.style.width = localStorage.getItem('chatSidebarWidth') || '280px';
      } else {
        chatSidebar.classList.add('collapsed');
        chatSidebar.style.width = '80px';
      }
    }
  }
  
  window.addEventListener('resize', applyChatSidebarState);
  chatBackdrop?.addEventListener('click', toggleSidebarAction);
"""

content = content.replace(js_old, js_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied to chat.html")
