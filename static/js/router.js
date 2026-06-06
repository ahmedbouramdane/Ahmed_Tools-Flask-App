(function() {
  'use strict';

  var contentEl = document.getElementById('content');
  if (!contentEl) return;

  var loadingBar = document.getElementById('loading-bar');

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function isInternalLink(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.hostname === location.hostname && a.protocol === location.protocol;
  }

  function shouldIntercept(anchor) {
    if (!anchor || !anchor.getAttribute('href')) return false;
    var href = anchor.getAttribute('href');
    if (href === '#' || href.startsWith('#')) return false;
    if (anchor.hasAttribute('download')) return false;
    if (anchor.hasAttribute('data-no-spa')) return false;
    if (anchor.target === '_blank' || anchor.target === '_external') return false;
    if (anchor.getAttribute('rel') === 'external') return false;
    return true;
  }

  function extractTitle(html) {
    var m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim() : null;
  }

  function reexecuteScripts(scriptNodes) {
    Array.from(scriptNodes).forEach(function(oldScript) {
      var ns = document.createElement('script');
      if (oldScript.src) {
        ns.src = oldScript.src;
      } else {
        ns.textContent = oldScript.textContent;
      }
      if (oldScript.type) ns.type = oldScript.type;
      if (oldScript.defer) ns.defer = true;
      if (oldScript.async) ns.async = true;
      if (oldScript.className) ns.className = oldScript.className;
      contentEl.appendChild(ns);
    });
  }

  function updateActiveNav(url) {
    var links = document.querySelectorAll('#sidebar a[href]');
    links.forEach(function(a) {
      var linkPath = a.getAttribute('href');
      a.classList.remove('bg-indigo-600', 'text-white', 'font-semibold');
      if (linkPath === url || (linkPath !== '/' && url.startsWith(linkPath))) {
        a.classList.add('bg-indigo-600', 'text-white', 'font-semibold');
      }
    });
  }

  function showLoading() {
    if (!loadingBar) return;
    loadingBar.classList.remove('hidden');
    loadingBar.style.width = '0%';
    requestAnimationFrame(function() {
      loadingBar.style.width = '60%';
    });
  }

  function hideLoading() {
    if (!loadingBar) return;
    loadingBar.style.width = '100%';
    setTimeout(function() {
      loadingBar.classList.add('hidden');
      loadingBar.style.width = '0%';
    }, 300);
  }

  function showError(msg) {
    if (!contentEl) return;
    contentEl.innerHTML =
      '<div class="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">' +
        '<i class="fas fa-exclamation-triangle text-5xl mb-4 text-red-400"></i>' +
        '<p class="text-lg font-medium mb-2">Failed to load page</p>' +
        '<p class="text-sm mb-4">' + (msg || 'An unexpected error occurred.') + '</p>' +
        '<button onclick="location.reload()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium">' +
          '<i class="fas fa-redo mr-1"></i> Reload' +
        '</button>' +
      '</div>';
  }

  // ─── Navigate ────────────────────────────────────────────────────────────
  function navigate(url, pushState, skipSameUrlCheck) {
    if (!url) return;
    if (!skipSameUrlCheck && url === location.href) return;
    showLoading();

    fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    })
    .then(function(html) {
      // Extract and update title
      var newTitle = extractTitle(html);
      if (newTitle) document.title = newTitle;

      // Parse the response HTML
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      // Get the new content element from response
      var newContent = doc.getElementById('content');
      if (!newContent) {
        window.location.href = url;
        return;
      }

      // ── Extract scripts from inside #content ──
      var scriptsInsideContent = Array.from(newContent.querySelectorAll('script'));

      // Remove them from the DOM tree so innerHTML doesn't include them
      scriptsInsideContent.forEach(function(s) { s.parentNode.removeChild(s); });

      // ── Extract scripts from outside #content (e.g. {% block scripts %}) ──
      var scriptsOutsideContent = [];
      var bodyScripts = doc.body ? Array.from(doc.body.querySelectorAll('script')) : [];
      bodyScripts.forEach(function(s) {
        // Only take scripts not inside #content
        if (!newContent.contains(s)) {
          scriptsOutsideContent.push(s);
          s.parentNode.removeChild(s);
        }
      });

      // ── Inject content ──
      contentEl.innerHTML = newContent.innerHTML;

      // ── Re-execute all scripts ──
      // First ones inside content, then ones from block scripts
      reexecuteScripts(scriptsInsideContent);
      reexecuteScripts(scriptsOutsideContent);

      // ── Update URL and nav ──
      updateActiveNav(url);

      if (pushState !== false) {
        history.pushState({ url: url, title: newTitle || '' }, '', url);
      }

      hideLoading();
    })
    .catch(function(err) {
      hideLoading();
      showError(err.message);
    });
  }

  // ─── Intercept Link Clicks ──────────────────────────────────────────────
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    if (!shouldIntercept(link)) return;
    var url = link.getAttribute('href');
    if (url === location.pathname + location.search + location.hash) return;
    if (!isInternalLink(url)) return;

    e.preventDefault();
    navigate(url, true, false);
  });

  // ─── Popstate ───────────────────────────────────────────────────────────
  window.addEventListener('popstate', function(e) {
    var state = e.state;
    if (state && state.url) {
      navigate(state.url, false, true);
    } else {
      location.reload();
    }
  });

  // ─── Expose ─────────────────────────────────────────────────────────────
  window.SPA = { navigate: navigate };
})();
