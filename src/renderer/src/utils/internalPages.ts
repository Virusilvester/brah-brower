import type { HistoryItem } from '../hooks/useHistory'

export function makeDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

export const INTERNAL_HOME_URL = 'brah://home'

export function getOfflineHomeUrl(topSites: HistoryItem[] = []): string {
  const escapeAttr = (value: string): string =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')

  // Get unique sites by hostname, sorted by most recent.
  // (So the same site doesn't show up over and over with different pages.)
  const uniqueSites = (() => {
    const sorted = [...topSites].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    const byHost = new Map<string, HistoryItem>()
    for (const item of sorted) {
      try {
        const host = new URL(item.url).hostname.replace(/^www\./, '')
        if (!host) continue
        if (!byHost.has(host)) byHost.set(host, item)
      } catch {
        // ignore invalid URLs
      }
    }
    return Array.from(byHost.values()).slice(0, 8)
  })()

  const sitesHtml =
    uniqueSites.length > 0
      ? uniqueSites
          .map((site) => {
            const domain = new URL(site.url).hostname.replace(/^www\./, '')
            const favicon =
              site.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
            const removeAction = `brah://remove-most-visited?host=${encodeURIComponent(domain)}`
            return `
          <div class="site-card" role="link" tabindex="0" data-url="${escapeAttr(
            site.url
          )}" title="${escapeAttr(site.title || site.url)}">
            <div class="site-actions">
              <button class="site-action remove" type="button" data-action="${escapeAttr(
                removeAction
              )}" title="Remove" aria-label="Remove from most visited">&times;</button>
            </div>
            <div class="site-icon">
              <img src="${escapeAttr(
                favicon
              )}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%231a1a1f%22/><text x=%2250%22 y=%2264%22 text-anchor=%22middle%22 font-size=%2254%22 fill=%22%23ffffff%22>W</text></svg>'">
            </div>
            <div class="site-name">${escapeAttr(domain)}</div>
          </div>
        `
          })
          .join('')
      : `
      <div class="empty-sites">
        <div class="empty-icon">&#128202;</div>
        <p>Your most visited sites will appear here</p>
      </div>
    `

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Brah Browser</title>
    <style>
      :root { 
        color-scheme: dark;
        --bg-primary: #0f0f12;
        --bg-secondary: #1a1a1f;
        --bg-card: #232329;
        --text-primary: #ffffff;
        --text-secondary: #a0a0a8;
        --accent: #4f46e5;
        --accent-hover: #6366f1;
        --border: rgba(255,255,255,0.08);
        --shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--bg-primary);
        background-image: 
          radial-gradient(ellipse at 20% 20%, rgba(79, 70, 229, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
        color: var(--text-primary);
        min-height: 100vh;
      }
      
      .container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 60px 24px 40px;
      }
      
      .logo {
        font-size: 42px;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 40px;
        letter-spacing: -1px;
      }
      
      .search-container {
        width: 100%;
        max-width: 680px;
        margin-bottom: 48px;
      }
      
      .search-box {
        position: relative;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 4px;
        box-shadow: var(--shadow);
        transition: all 0.3s ease;
      }
      
      .search-box:focus-within {
        border-color: var(--accent);
        box-shadow: 0 8px 32px rgba(79, 70, 229, 0.2);
      }
      
      .search-form {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
      }
      
      .search-icon {
        width: 20px;
        height: 20px;
        color: var(--text-secondary);
        flex-shrink: 0;
      }
      
      .search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-primary);
        font-size: 16px;
        font-family: inherit;
      }
      
      .search-input::placeholder {
        color: var(--text-secondary);
      }

      .suggestions {
        position: absolute;
        top: calc(100% + 10px);
        left: 0;
        right: 0;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: var(--shadow);
        overflow: hidden;
        z-index: 10;
        padding: 6px;
        display: none;
      }

      .suggestions.show {
        display: block;
      }

      .suggestion-item {
        width: 100%;
        border: none;
        background: transparent;
        color: var(--text-primary);
        text-align: left;
        padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
      }

      .suggestion-item:hover,
      .suggestion-item.active {
        background: rgba(255,255,255,0.08);
      }
      
      .search-btn {
        background: var(--accent);
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .search-btn:hover {
        background: var(--accent-hover);
        transform: translateY(-1px);
      }
      
      .shortcuts-section {
        width: 100%;
        max-width: 800px;
      }
      
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding: 0 8px;
      }
      
      .section-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .sites-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 16px;
      }

      .site-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 20px 16px;
        text-align: center;
        text-decoration: none;
        transition: all 0.2s ease;
        cursor: pointer;
        position: relative;
      }
      
      .site-card:hover {
        background: rgba(255,255,255,0.05);
        border-color: rgba(255,255,255,0.15);
        transform: translateY(-2px);
      }
      
      .site-icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 12px;
        background: var(--bg-secondary);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      
      .site-icon img {
        width: 28px;
        height: 28px;
        object-fit: contain;
      }
      
      .site-name {
        font-size: 12px;
        color: var(--text-primary);
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .site-actions {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      .site-card:hover .site-actions,
      .site-card:focus-within .site-actions {
        opacity: 1;
      }

      .site-action {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.06);
        color: var(--text-primary);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .site-action:hover {
        background: rgba(255,255,255,0.10);
      }

      .site-action.remove:hover {
        background: rgba(239, 68, 68, 0.18);
        border-color: rgba(239, 68, 68, 0.4);
      }
      
      .empty-sites {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary);
      }
      
      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.6;
      }
      
      .empty-sites p {
        font-size: 14px;
      }
      
      .tips {
        margin-top: auto;
        padding-top: 40px;
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .tip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 20px;
        font-size: 12px;
        color: var(--text-secondary);
      }
      
      .tip code {
        background: rgba(255,255,255,0.1);
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 11px;
        color: var(--text-primary);
      }
      
      @media (max-width: 600px) {
        .container {
          padding: 40px 16px;
        }
        
        .logo {
          font-size: 32px;
        }
        
        .sites-grid {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
        }
        
        .site-card {
          padding: 16px 12px;
        }
        
        .site-icon {
          width: 40px;
          height: 40px;
        }
        
        .site-icon img {
          width: 24px;
          height: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="logo">Brah</h1>
      
      <div class="search-container">
        <div class="search-box">
          <form class="search-form" action="https://www.google.com/search" method="GET">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="text" 
              name="q" 
              class="search-input" 
              placeholder="Search Google or type a URL" 
              autofocus
              autocomplete="off"
            >
	            <button type="submit" class="search-btn">Search</button>
	          </form>
	          <div class="suggestions" id="suggestions" role="listbox" aria-label="Search suggestions"></div>
	        </div>
	      </div>
      
      <div class="shortcuts-section">
        <div class="section-header">
          <span class="section-title">Most Visited</span>
        </div>
        <div class="sites-grid">
          ${sitesHtml}
        </div>
      </div>
      
      <div class="tips">
        <div class="tip">
          <span>Press</span>
          <code>Ctrl+L</code>
          <span>to focus address bar</span>
        </div>
        <div class="tip">
          <span>Press</span>
          <code>Ctrl+T</code>
          <span>for new tab</span>
        </div>
      </div>
    </div>
    
    <script>
	      // Focus search on load
	      document.querySelector('.search-input').focus();

	      // Google suggestions
	      (function () {
	        var input = document.querySelector('.search-input');
	        var box = document.getElementById('suggestions');
	        if (!input || !box) return;

	        var timer = null;
	        var fetchId = 0;
	        var active = -1;
	        var items = [];

	        function hide() {
	          box.classList.remove('show');
	          box.innerHTML = '';
	          active = -1;
	          items = [];
	        }

	        function show(list) {
	          items = Array.isArray(list) ? list.filter(function (v) { return typeof v === 'string'; }).slice(0, 8) : [];
	          if (items.length === 0) {
	            hide();
	            return;
	          }
	          box.innerHTML = items
	            .map(function (s, idx) {
	              var safe = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	              return '<button type="button" class="suggestion-item" data-idx="' + idx + '">' + safe + '</button>';
	            })
	            .join('');
	          box.classList.add('show');
	          active = -1;
	        }

	        function updateActive() {
	          var nodes = box.querySelectorAll('.suggestion-item');
	          for (var i = 0; i < nodes.length; i++) {
	            if (i === active) nodes[i].classList.add('active');
	            else nodes[i].classList.remove('active');
	          }
	        }

	        input.addEventListener('input', function () {
	          var q = String(input.value || '').trim();
	          if (timer) clearTimeout(timer);
	          if (q.length < 2) {
	            hide();
	            return;
	          }
	          timer = setTimeout(function () {
	            var id = ++fetchId;
	            fetch('https://suggestqueries.google.com/complete/search?client=firefox&q=' + encodeURIComponent(q))
	              .then(function (r) { return r.json(); })
	              .then(function (data) {
	                if (id !== fetchId) return;
	                var list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
	                show(list);
	              })
	              .catch(function () {
	                if (id !== fetchId) return;
	                hide();
	              });
	          }, 140);
	        });

	        input.addEventListener('keydown', function (e) {
	          if (!box.classList.contains('show')) return;
	          if (e.key === 'Escape') {
	            hide();
	            return;
	          }
	          if (e.key === 'ArrowDown') {
	            e.preventDefault();
	            active = Math.min(items.length - 1, active + 1);
	            updateActive();
	            return;
	          }
	          if (e.key === 'ArrowUp') {
	            e.preventDefault();
	            active = Math.max(-1, active - 1);
	            updateActive();
	            return;
	          }
	          if (e.key === 'Enter' && active >= 0) {
	            e.preventDefault();
	            var val = items[active];
	            if (val) {
	              input.value = val;
	              hide();
	              try { location.href = 'https://www.google.com/search?q=' + encodeURIComponent(val); } catch (err) {}
	            }
	          }
	        });

	        box.addEventListener('mousedown', function (e) {
	          e.preventDefault();
	        });

	        box.addEventListener('click', function (e) {
	          var target = e.target;
	          if (!target || !target.getAttribute) return;
	          var idx = Number(target.getAttribute('data-idx') || '-1');
	          if (idx < 0 || idx >= items.length) return;
	          var val = items[idx];
	          if (!val) return;
	          input.value = val;
	          hide();
	          try { location.href = 'https://www.google.com/search?q=' + encodeURIComponent(val); } catch (err) {}
	        });

	        input.addEventListener('blur', function () {
	          setTimeout(hide, 160);
	        });
	      })();
	      
	      // Handle form submission for internal URLs
	      document.querySelector('.search-form').addEventListener('submit', function(e) {
	        const query = document.querySelector('.search-input').value.trim();
        if (!query) {
          e.preventDefault();
          return;
        }
        
        // If it looks like a URL, navigate directly
        if (query.includes('.') && !query.includes(' ') && !query.startsWith('http')) {
          e.preventDefault();
          window.location.href = 'https://' + query;
        } else if (query.startsWith('http://') || query.startsWith('https://')) {
          e.preventDefault();
          window.location.href = query;
        }
        // Otherwise let it go to Google search
      });

      // Most visited interactions (event delegation)
	      var grid = document.querySelector('.sites-grid');
	      if (grid) {
	        grid.addEventListener('click', function(e) {
	          var target = e.target;
	          var actionBtn = target && target.closest ? target.closest('.site-action') : null;
	          if (actionBtn) {
	            e.preventDefault();
	            e.stopPropagation();
	            var action = actionBtn.getAttribute('data-action') || '';
	            if (actionBtn.classList.contains('remove')) {
	              if (!confirm('Remove this site from Most Visited?')) return;
	            }
	            try { location.href = action; } catch (err) {}
	            return;
	          }

          var card = target && target.closest ? target.closest('.site-card') : null;
          if (card) {
            var url = card.getAttribute('data-url') || '';
            if (url) {
              try { location.href = url; } catch (err) {}
            }
          }
        });

        grid.addEventListener('keydown', function(e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          var target = e.target;
          var card = target && target.closest ? target.closest('.site-card') : null;
          if (!card) return;
          e.preventDefault();
          var url = card.getAttribute('data-url') || '';
          if (url) {
            try { location.href = url; } catch (err) {}
          }
        });
      }
    </script>
  </body>
</html>`

  return makeDataUrl(html)
}

export function resolveInternalUrl(url: string): string {
  if (!url || url === INTERNAL_HOME_URL) {
    let history: HistoryItem[] = []
    try {
      const raw = localStorage.getItem('brah-history')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) history = parsed as HistoryItem[]
      }
    } catch {
      history = []
    }
    return getOfflineHomeUrl(history)
  }
  return url
}

export function isInternalDataUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('data:text/html')
}

function getErrorTitle(errorCode: number): string {
  if (errorCode === -106) return 'No internet'
  if (errorCode === -105) return 'Server not found'
  if (errorCode === -102) return 'Connection refused'
  if (errorCode === -118) return 'Connection timed out'
  if (errorCode === -109) return 'Address unreachable'
  return "This site can't be reached"
}

function getErrorHint(errorCode: number): string {
  if (errorCode === -106) return 'Check your internet connection and try again.'
  if (errorCode === -105) return 'Check the address and your DNS settings.'
  if (errorCode === -102) return 'The site refused the connection.'
  if (errorCode === -118) return 'The site took too long to respond.'
  if (errorCode === -109) return 'The address is unreachable.'
  return 'Try checking the connection and the site address.'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getLoadErrorUrl(params: {
  attemptedUrl: string
  errorCode: number
  errorDescription?: string
}): string {
  const title = getErrorTitle(params.errorCode)
  const hint = getErrorHint(params.errorCode)
  const attemptedUrl = params.attemptedUrl || 'unknown'
  const details =
    params.errorDescription && params.errorDescription.trim()
      ? `${params.errorDescription} (${params.errorCode})`
      : `Error code: ${params.errorCode}`

  const attemptedJson = JSON.stringify(attemptedUrl)

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { 
        color-scheme: dark;
        --bg-primary: #0f0f12;
        --bg-secondary: #1a1a1f;
        --text-primary: #ffffff;
        --text-secondary: #a0a0a8;
        --accent: #4f46e5;
        --border: rgba(255,255,255,0.08);
      }
      
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--bg-primary);
        color: var(--text-primary);
        min-height: 100vh;
      }
      
      .wrap { 
        min-height: 100vh; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        padding: 24px; 
      }
      
      .card {
        width: 100%;
        max-width: 560px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      
      .error-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 24px;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
      }
      
      h1 { 
        margin: 0 0 12px 0; 
        font-size: 24px; 
        font-weight: 700; 
      }
      
      .muted { 
        color: var(--text-secondary); 
        font-size: 15px; 
        line-height: 1.6; 
        margin-bottom: 8px;
      }
      
      .url { 
        margin: 20px 0 8px;
        padding: 12px 16px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
        font-size: 13px; 
        color: var(--text-primary);
        word-break: break-all;
        font-family: 'SF Mono', Monaco, monospace;
      }
      
      .details { 
        font-size: 12px; 
        color: rgba(160,160,168,0.6); 
      }
      
      .actions { 
        margin-top: 32px; 
        display: flex; 
        gap: 12px; 
        justify-content: center;
        flex-wrap: wrap;
      }
      
      button {
        padding: 12px 24px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.06);
        color: var(--text-primary);
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      button:hover { 
        background: rgba(255,255,255,0.1); 
      }
      
      button.primary {
        background: var(--accent);
        border-color: var(--accent);
      }
      
      button.primary:hover {
        background: #6366f1;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="error-icon">⚠️</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="muted">${escapeHtml(hint)}</div>
        <div class="url">${escapeHtml(attemptedUrl)}</div>
        <div class="details">${escapeHtml(details)}</div>
        <div class="actions">
          <button id="retry" class="primary">Reload</button>
          <button id="home">Go to start page</button>
          <button id="copy">Copy URL</button>
        </div>
      </div>
    </div>
    <script>
      (function () {
        var attempted = ${attemptedJson};
        document.getElementById('retry').addEventListener('click', function () {
          try { location.href = attempted; } catch (e) {}
        });
        document.getElementById('home').addEventListener('click', function () {
          try { location.href = 'brah://home'; } catch (e) {}
        });
        document.getElementById('copy').addEventListener('click', function () {
          try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(attempted);
              return;
            }
          } catch (e) {}
          try {
            var input = document.createElement('input');
            input.value = attempted;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
          } catch (e) {}
        });
      })();
    </script>
  </body>
</html>`

  return makeDataUrl(html)
}
