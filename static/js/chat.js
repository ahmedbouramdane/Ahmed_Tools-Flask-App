/**
 * AI Chat Module - Handles AJAX communication for chat functionality
 * This module provides a modern, reliable chat experience with proper AJAX handling
 */
(function() {
  'use strict';

  // Chat Manager Class
  class ChatManager {
    constructor() {
      this.currentChatId = null;
      this.isInitialized = false;
      this.typingAnimations = {};
      this.animationCounter = 0;
    }

    /**
     * Initialize the chat manager with the current chat context
     */
    init(chatId) {
      if (this.isInitialized) {
        this.cleanup();
      }
      
      this.currentChatId = chatId;
      this.isInitialized = true;
      
      this.setupNewChatButton();
      this.setupChatForm();
      this.setupMessageDeletion();
      this.initializeTypingSpeed();
      
      console.log('[Chat] Initialized for chat ID:', chatId);
    }

    /**
     * Cleanup previous event listeners and animations
     */
    cleanup() {
      // Stop all typing animations
      Object.keys(this.typingAnimations).forEach(id => {
        if (this.typingAnimations[id]) {
          this.typingAnimations[id].isRunning = false;
        }
      });
      this.typingAnimations = {};
    }

    /**
     * Setup the "New Chat" button to use AJAX
     */
    setupNewChatButton() {
      const newChatForms = document.querySelectorAll('.new-chat-form');
      newChatForms.forEach(form => {
        // Remove any existing listeners by cloning
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.createNewChat(newForm);
        });
      });
    }

    /**
     * Create a new chat session via AJAX
     */
    async createNewChat(form) {
      // Handle empty-state button called without form argument
      if (!form) {
        const resp = await fetch('/chat/new', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (resp.ok) {
          const data = await resp.json();
          if (data.url) {
            if (window.SPA && window.SPA.navigate) { window.SPA.navigate(data.url, true); }
            else { window.location.href = data.url; }
          }
        }
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalContent = submitBtn ? submitBtn.innerHTML : '';
      
      try {
        // Show loading state
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to create chat');
        }

        const data = await response.json();
        
        if (data.url) {
          // Use SPA navigation if available, otherwise direct navigation
          if (window.SPA && window.SPA.navigate) {
            window.SPA.navigate(data.url, true);
          } else {
            window.location.href = data.url;
          }
        }
      } catch (error) {
        console.error('[Chat] Error creating new chat:', error);
        this.showError('Failed to create new chat. Please try again.');
        
        // Fallback to regular form submission
        if (!form.classList.contains('fallback-used')) {
          form.classList.add('fallback-used');
          form.submit();
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalContent;
        }
      }
    }

    /**
     * Setup the chat message form to use AJAX
     */
    setupChatForm() {
      const chatForm = document.getElementById('chat-form');
      if (!chatForm || !this.currentChatId) return;

      // Remove any existing listeners by cloning
      const newForm = chatForm.cloneNode(true);
      chatForm.parentNode.replaceChild(newForm, chatForm);
      
      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.sendMessage();
      });

      // Get input reference from the new (in-DOM) form
      const messageInput = document.getElementById('message-input');

      // Auto-detect Arabic and apply RTL styling
      if (messageInput) {
        messageInput.addEventListener('input', () => {
          const isArabic = this.detectArabic(messageInput.value);
          messageInput.style.direction = isArabic ? 'rtl' : 'ltr';
          messageInput.style.textAlign = isArabic ? 'right' : 'left';
          messageInput.style.fontFamily = isArabic ? "'Cairo', sans-serif" : 'inherit';
        });
      }
    }

    /**
     * Send a message via AJAX
     */
    async sendMessage() {
      const messageInput = document.getElementById('message-input');
      if (!messageInput || !this.currentChatId) return;

      const message = messageInput.value.trim();
      if (!message) return;

      // Clear input and disable
      messageInput.value = '';
      messageInput.disabled = true;
      messageInput.style.direction = 'ltr';
      messageInput.style.fontFamily = 'inherit';
      messageInput.focus();

      // Remove empty chat message if present
      const emptyChat = document.getElementById('empty-chat');
      if (emptyChat) emptyChat.remove();

      // Add user message to chat
      const userTime = new Date().toTimeString().slice(0, 5);
      this.appendMessage('user', message, userTime);

      // Show thinking indicator
      const messagesContainer = document.getElementById('chat-messages');
      const thinkingEl = document.createElement('div');
      thinkingEl.className = 'flex justify-start mb-4';
      thinkingEl.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
      messagesContainer.appendChild(thinkingEl);
      this.scrollToBottom();

      try {
        const response = await fetch(`/chat/${this.currentChatId}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: new URLSearchParams({ message })
        });

        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json();
          } catch (e) {}
          throw new Error(errorData.error || errorData.message || 'Failed to send message');
        }

        const data = await response.json();
        
        // Remove thinking indicator
        thinkingEl.remove();

        // Add AI response
        if (data.ai_message) {
          this.appendAIMessage(data.ai_message.content, data.ai_message.created_at, data.ai_message.id);
          
          // Update message count
          const countSpan = document.getElementById('message-count');
          if (countSpan) {
            const current = parseInt(countSpan.innerText) || 0;
            countSpan.innerText = (current + 2) + ' messages';
          }

          // Update chat title if returned
          if (data.chat_title) {
            var titleEl = document.getElementById('chat-title-display');
            if (titleEl) titleEl.textContent = data.chat_title;
            // Also update sidebar entry
            var sidebarTitle = document.querySelector('#chat-item-' + this.currentChatId + ' a span');
            if (sidebarTitle) sidebarTitle.textContent = data.chat_title;
          }
        }
      } catch (error) {
        console.error('[Chat] Error sending message:', error);
        thinkingEl.remove();
        
        const errorEl = document.createElement('div');
        errorEl.className = 'text-red-500 text-sm text-center mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg';
        errorEl.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> ${error.message}`;
        messagesContainer.appendChild(errorEl);
        this.scrollToBottom();
      } finally {
        messageInput.disabled = false;
        messageInput.focus();
      }
    }

    /**
     * Append a user message to the chat
     */
    appendMessage(role, content, time) {
      const container = document.getElementById('chat-messages');
      if (!container) return;

      const div = document.createElement('div');
      const isArabic = this.detectArabic(content);
      div.className = `flex items-start gap-3 ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
      div.style.direction = isArabic ? 'rtl' : 'ltr';
      
      div.innerHTML = `
        <div class="max-w-[75%] rounded-2xl px-4 py-2.5 relative group ${role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200'}" style="direction: ${isArabic ? 'rtl' : 'ltr'}; text-align: ${isArabic ? 'right' : 'left'}; font-family: ${isArabic ? "'Cairo', sans-serif" : 'inherit'};">
          <div class="${role === 'user' ? 'whitespace-pre-wrap' : 'assistant-content markdown-body'} text-sm" style="word-break: break-word;">${role === 'user' ? this.escapeHtml(content) : ''}</div>
          <span class="text-xs ${role === 'user' ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'} mt-1 block">${time}</span>
        </div>
      `;
      
      container.appendChild(div);
      this.scrollToBottom();
      return div;
    }

    /**
     * Append an AI message with typing animation
     */
    appendAIMessage(content, time, msgId) {
      const container = document.getElementById('chat-messages');
      if (!container) return;

      const div = document.createElement('div');
      const isArabic = this.detectArabic(content);
      div.className = 'flex justify-start mb-4';
      div.style.direction = isArabic ? 'rtl' : 'ltr';
      
      div.innerHTML = `
        <div class="max-w-[75%] rounded-2xl px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 relative group" style="direction: ${isArabic ? 'rtl' : 'ltr'}; text-align: ${isArabic ? 'right' : 'left'};">
          <div class="assistant-content markdown-body text-sm" style="word-break: break-word;"></div>
          <div class="flex justify-between items-center mt-2 gap-2 flex-wrap" style="flex-direction: ${isArabic ? 'row-reverse' : 'row'};">
            <span class="text-xs text-gray-400 dark:text-gray-500">${time}</span>
            <div class="flex gap-2">
              <button id="stop-typing-btn-${msgId || 'temp'}" class="text-xs text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 transition" title="Show full answer"><i class="fas fa-forward"></i> Show Full</button>
              ${msgId ? `<button class="download-pdf-btn" data-msg-id="${msgId}" title="Download PDF"><i class="fas fa-file-pdf"></i> PDF</button>` : ''}
            </div>
          </div>
        </div>
      `;
      
      container.appendChild(div);

      const contentDiv = div.querySelector('.assistant-content');
      const stopBtn = div.querySelector(`#stop-typing-btn-${msgId || 'temp'}`);
      
      // Get typing speed from localStorage
      const typingSpeed = parseInt(localStorage.getItem('typingSpeed')) || 8;
      
      // Start typing animation
      const animation = this.typeOutMessage(contentDiv, content, isArabic, typingSpeed, () => {
        if (stopBtn) stopBtn.classList.add('hidden');
        
        // Render full markdown after typing
        contentDiv.innerHTML = marked.parse(content);
        this.processCodeBlocks(contentDiv);
        // Small delay to let DOM settle before Prism highlighting
        requestAnimationFrame(() => {
          this.highlightCode(contentDiv);
          this.enhanceDynamicCodeBlocks(contentDiv);
          this.renderMath(contentDiv);
        });
      });
      
      // Setup stop button
      if (stopBtn) {
        stopBtn.classList.remove('hidden');
        stopBtn.dataset.animationId = animation.animationId;
        stopBtn.addEventListener('click', () => this.stopTypingAnimation(stopBtn));
      }
      
      // Setup PDF download
      const pdfBtn = div.querySelector('.download-pdf-btn');
      if (pdfBtn) {
        pdfBtn.addEventListener('click', () => this.downloadPDF(div));
      }
      
      this.scrollToBottom();
    }

    /**
     * Type out message in word chunks with progressive markdown rendering
     */
    typeOutMessage(element, content, isArabic, typingSpeed = 8, callback) {
      const baseInterval = 25;
      const charsPerTick = Math.max(1, Math.min(Math.round(baseInterval / typingSpeed), 40));
      const tickInterval = typingSpeed <= baseInterval ? baseInterval : typingSpeed;

      let index = 0;
      const animationId = ++this.animationCounter;

      this.typingAnimations[animationId] = { isRunning: true, fullContent: content };

      const tick = () => {
        if (!this.typingAnimations[animationId]?.isRunning) {
          delete this.typingAnimations[animationId];
          return;
        }
        if (index >= content.length) {
          if (callback) callback();
          delete this.typingAnimations[animationId];
          return;
        }

        index = Math.min(index + charsPerTick, content.length);
        element.innerHTML = this.processMarkdownPartial(content.slice(0, index));
        element.style.direction = isArabic ? 'rtl' : 'ltr';
        element.style.textAlign = isArabic ? 'right' : 'left';
        this.scrollToBottom();

        setTimeout(tick, tickInterval);
      };

      tick();
      return { animationId };
    }

    /**
     * Stop typing animation and show full content
     */
    stopTypingAnimation(btn) {
      const animationId = parseInt(btn.dataset.animationId);
      if (animationId && this.typingAnimations[animationId]) {
        const entry = this.typingAnimations[animationId];
        entry.isRunning = false;
        btn.classList.add('hidden');
        
        // Find the .assistant-content sibling (btn is inside the bubble, content is a sibling)
        const msgEl = btn.closest('.flex.justify-start');
        const contentDiv = msgEl ? msgEl.querySelector('.assistant-content') : null;
        if (contentDiv) {
          const fullContent = entry.fullContent;
          if (fullContent) {
            contentDiv.innerHTML = marked.parse(fullContent);
            this.processCodeBlocks(contentDiv);
            this.highlightCode(contentDiv);
            this.enhanceDynamicCodeBlocks(contentDiv);
            this.renderMath(contentDiv);
          }
        }
      }
    }

    /**
     * Wrap code blocks with language label and copy button (for dynamic responses)
     */
    enhanceDynamicCodeBlocks(container) {
      if (!container) return;
      container.querySelectorAll('pre code').forEach(codeBlock => {
        const pre = codeBlock.parentElement;
        if (pre.closest('.code-block-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        const langClass = codeBlock.className.match(/language-(\w+)/);
        const lang = langClass ? langClass[1] : 'code';
        const langIcon = langClass ? this.getLangIcon(lang) : 'fas fa-code';
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = '<span class="lang-label"><i class="' + langIcon + '"></i> ' + lang + '</span>';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        copyBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const text = codeBlock.textContent;
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
              copyBtn.classList.remove('copied');
            }, 2000);
          });
        });
        header.appendChild(copyBtn);
        pre.parentElement.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
      });
    }

    getLangIcon(lang) {
      const icons = {
        python: 'fab fa-python', py: 'fab fa-python',
        java: 'fab fa-java',
        html: 'fab fa-html5', css: 'fab fa-css3-alt',
        javascript: 'fas fa-code', js: 'fas fa-code',
        typescript: 'fas fa-code', ts: 'fas fa-code',
      };
      return icons[lang] || 'fas fa-code';
    }

    /**
     * Process markdown partially using marked.parse with code-block safety
     */
    processMarkdownPartial(text) {
      if (!text) return '';
      const fenceCount = (text.match(/```/g) || []).length;
      const inFence = fenceCount % 2 === 1;
      const safeText = inFence ? text + '\n```' : text;
      return marked.parse(safeText);
    }

    /**
     * Process code blocks for highlighting
     */
    processCodeBlocks(container) {
      if (!container) return;
      
      container.querySelectorAll('pre code').forEach(block => {
        const pre = block.parentElement;
        const langClass = block.className.match(/language-(\w+)/);
        if (langClass) {
          pre.classList.add('line-numbers', 'language-' + langClass[1]);
        } else {
          pre.classList.add('line-numbers');
          block.classList.add('language-text');
        }
      });
    }

    /**
     * Highlight code using Prism
     */
    highlightCode(container) {
      if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(container);
      }
    }

    /**
     * Render math equations using KaTeX
     */
    renderMath(container) {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(container, {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false},
            {left: "\\(", right: "\\)", display: false},
            {left: "\\[", right: "\\]", display: true}
          ],
          throwOnError: false
        });
      }
    }

    /**
     * Download chat as PDF
     */
    downloadPDF(element) {
      const content = element.querySelector('.assistant-content').cloneNode(true);
      content.style.padding = '20px';
      content.style.backgroundColor = 'white';
      content.style.color = 'black';
      content.style.fontFamily = 'Arial, sans-serif';
      
      const opt = {
        margin: 0.5,
        filename: 'AI_Response.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(content).save();
    }

    /**
     * Setup message deletion
     */
    setupMessageDeletion() {
      // Make deleteMessage globally available
      window.deleteMessage = async (msgId) => {
        const result = await Swal.fire({
          title: 'Delete this message?',
          text: "This cannot be undone.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#e53e3e',
          cancelButtonColor: '#718096',
          confirmButtonText: 'Yes, delete it!'
        });
        
        if (result.isConfirmed) {
          try {
            const resp = await fetch(`/chat/message/${msgId}/delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (resp.ok) {
              const btn = document.querySelector(`button[onclick="deleteMessage(${msgId})"]`);
              if (btn) {
                const messageDiv = btn.closest('.flex.items-start');
                if (messageDiv) messageDiv.remove();
              }
              
              const countSpan = document.getElementById('message-count');
              if (countSpan) {
                const current = parseInt(countSpan.innerText) || 0;
                countSpan.innerText = Math.max(0, current - 1) + ' messages';
              }
              
              Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Message deleted',
                showConfirmButton: false,
                timer: 2000
              });
            }
          } catch (error) {
            Swal.fire('Error', 'Could not delete message.', 'error');
          }
        }
      };
    }

    /**
     * Initialize typing speed from localStorage
     */
    initializeTypingSpeed() {
      const savedSpeed = localStorage.getItem('typingSpeed') || '8';
      const slider = document.getElementById('typing-speed-slider');
      const display = document.getElementById('speed-display');
      
      if (slider) {
        slider.value = savedSpeed;
        if (display) display.textContent = savedSpeed + 'ms';
        
        slider.addEventListener('change', (e) => {
          localStorage.setItem('typingSpeed', e.target.value);
          if (display) display.textContent = e.target.value + 'ms';
        });
      }
    }

    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
      const messagesDiv = document.getElementById('chat-messages');
      if (!messagesDiv) return;
      
      const isNearBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100;
      if (isNearBottom) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    }

    /**
     * Detect Arabic text
     */
    detectArabic(text) {
      const arabicRegex = /[\u0600-\u06FF]/g;
      return arabicRegex.test(text);
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Show error message
     */
    showError(message) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: message,
        showConfirmButton: false,
        timer: 4000
      });
    }
  }

  // Create global instance - preserve on SPA re-loads
  if (!window.ChatManager) {
    window.ChatManager = new ChatManager();
  }

  // Scroll-to-top message pagination for AI Chat
  window.setupChatScrollPagination = function(hasOlder) {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    container._hasOlder = hasOlder;
    container._loadingOlder = false;
    container.removeEventListener('scroll', window._chatScrollHandler);
    window._chatScrollHandler = function() {
      if (container.scrollTop < 80 && !container._loadingOlder && container._hasOlder) {
        container._loadingOlder = true;
        loadOlderChatMessages(container);
      }
    };
    container.addEventListener('scroll', window._chatScrollHandler);
  };

  window.loadOlderChatMessages = function(container) {
    var chatId = window.ChatManager ? window.ChatManager.currentChatId : null;
    if (!chatId) { container._loadingOlder = false; return; }
    var oldestMsg = container.querySelector('.flex.items-start');
    var oldestId = oldestMsg ? oldestMsg.id.replace('msg-', '') : null;
    var params = '?offset=0&limit=6&before=' + (oldestId || '');
    var oldScrollHeight = container.scrollHeight;

    var loader = document.createElement('div');
    loader.className = 'text-center py-3 text-gray-400 text-sm';
    loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading older messages...';
    container.insertBefore(loader, container.firstChild);

    fetch('/chat/' + chatId + '/messages' + params)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        loader.remove();
        container._hasOlder = data.has_more;
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(function(msg) {
            var div = document.createElement('div');
            div.className = 'flex items-start gap-2 mb-4 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start');
            div.id = 'msg-' + msg.id;
            var time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            var isAr = window.ChatManager ? window.ChatManager.detectArabic(msg.content) : false;
            var content = window.ChatManager ? window.ChatManager.escapeHtml(msg.content) : msg.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            div.innerHTML = '<div class="max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ' + (msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200') + '" style="direction:' + (isAr ? 'rtl' : 'ltr') + ';text-align:' + (isAr ? 'right' : 'left') + '"><div class="text-sm whitespace-pre-wrap break-words">' + content + '</div><span class="text-xs mt-1 block ' + (msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400') + '">' + time + '</span></div>';
            container.insertBefore(div, container.firstChild);
          });
          container.scrollTop = Math.max(1, container.scrollHeight - oldScrollHeight + 50);
        }
        container._loadingOlder = false;
      })
      .catch(function() { loader.remove(); container._loadingOlder = false; });
  };

  // Auto-initialize when DOM is ready
  function initChatFromDOM() {
    const chatForm = document.getElementById('chat-form');
    const chatIdInput = document.getElementById('current-chat-id');
    
    if (chatForm) {
      // Try to get chat ID from data attribute or hidden input
      let chatId = chatForm.dataset.chatId;
      if (!chatId) {
        const urlMatch = window.location.pathname.match(/\/chat\/(\d+)/);
        if (urlMatch) {
          chatId = urlMatch[1];
        }
      }
      if (!chatId && chatIdInput) {
        chatId = chatIdInput.value;
      }
      
      if (chatId) {
        window.ChatManager.init(chatId);
      }
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatFromDOM);
  } else {
    initChatFromDOM();
  }

  // Re-initialize after SPA navigation
  document.addEventListener('spa navigated', () => {
    setTimeout(initChatFromDOM, 100);
  });

})();