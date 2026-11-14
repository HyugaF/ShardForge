import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

interface CachedAsset {
  timestamp: number;
  contentType: string;
  body: Buffer;
}

const CACHE_TTL_MS = 1000 * 60 * 30;
const siteAssetCache = new Map<string, CachedAsset>();
const MAX_SITE_CACHE_ENTRIES = 600;

const SITE_MIRRORS = {
  latest: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main',
  classic2014: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main',
};

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath.split('?')[0]).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

function buildInjectedBridgeHtml(): string {
  return `
<style id="shardforge-injected-styles">
  .cancer__wrp-sidebar,
  .cancer__wrp-leaderboard,
  .cancer__wrp-mobile-1,
  .cancer__disp-cancer,
  .cancer__anchor {
    display: none !important;
  }
  #shardforge-floating-bar {
    position: fixed;
    bottom: 14px;
    right: 14px;
    z-index: 99999;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px 7px 13px;
    background: #18181b;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    line-height: 1.2;
  }
  #shardforge-floating-bar .sf-title {
    max-width: 210px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    color: #f4f4f5;
  }
  #shardforge-floating-bar .sf-btn {
    border: 0;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.15s ease;
  }
  #shardforge-floating-bar .sf-btn-queue {
    background: #27272a;
    color: #e4e4e7;
    border: 1px solid #52525b;
  }
  #shardforge-floating-bar .sf-btn-queue:hover {
    background: #3f3f46;
  }
  #shardforge-floating-bar .sf-btn-queue.is-queued {
    background: #14532d;
    color: #dcfce7;
    border-color: #16a34a;
  }
  #shardforge-floating-bar .sf-btn-convert {
    background: #991b1b;
    color: #ffffff;
  }
  #shardforge-floating-bar .sf-btn-convert:hover {
    background: #7f1d1d;
  }
</style>
<script id="shardforge-bridge-script">
(function () {
  if (window.__SHARDFORGE_BRIDGE_ACTIVE__) return;
  window.__SHARDFORGE_BRIDGE_ACTIVE__ = true;

  var lastSignature = '';
  var isQueuedState = false;

  function detectPageFile() {
    var parts = window.location.pathname.split('/');
    var last = parts[parts.length - 1] || 'bestiary.html';
    if (!last.toLowerCase().endsWith('.html')) return 'bestiary.html';
    return last;
  }

  function safeCloneEntity(rawEnt, pageFile) {
    if (!rawEnt || typeof rawEnt !== 'object') return null;
    try {
      var pageLower = (pageFile || '').toLowerCase();
      if (pageLower.indexOf('classes.html') !== -1 && window.dbg_page) {
        var activeSubclasses = [];
        var st = window.dbg_page._state || {};
        if (Array.isArray(rawEnt.subclasses) && window.UrlUtil && typeof window.UrlUtil.getStateKeySubclass === 'function') {
          for (var i = 0; i < rawEnt.subclasses.length; i++) {
            var sc = rawEnt.subclasses[i];
            var key = window.UrlUtil.getStateKeySubclass(sc);
            if (st[key]) {
              activeSubclasses.push(sc);
            }
          }
        }
        return JSON.parse(JSON.stringify({
          _shardforgeType: 'class',
          classObj: rawEnt,
          activeSubclasses: activeSubclasses
        }));
      }
      return JSON.parse(JSON.stringify(rawEnt));
    } catch (_err) {
      return null;
    }
  }

  function extractActiveEntry() {
    var pageFile = detectPageFile();
    var pageContent = document.getElementById('pagecontent');
    var classTable = document.getElementById('classtable');
    var bookContent = document.querySelector('.wrp-stat-block') || pageContent;

    var rawEntity = null;
    if (window.dbg_page) {
      if (pageFile.toLowerCase().indexOf('classes.html') !== -1 && window.dbg_page.activeClass) {
        rawEntity = window.dbg_page.activeClass;
      } else if (window.dbg_page._lastRender && window.dbg_page._lastRender.entity) {
        rawEntity = window.dbg_page._lastRender.entity;
      }
    }

    var clonedEntity = safeCloneEntity(rawEntity, pageFile);

    var container = pageContent || bookContent;
    var textLen = container ? (container.innerText || '').trim().length : 0;

    if (!clonedEntity && textLen < 12) return null;

    var nameEl =
      (container && (
        container.querySelector('.ve-stats__h-name') ||
        container.querySelector('th.ve-stats__th-name h1') ||
        container.querySelector('.stats-name') ||
        container.querySelector('th.rnd-name h1, th.rnd-name span') ||
        container.querySelector('.rd__h--0 .rd__h-toggle ~ span, .rd__h--0') ||
        container.querySelector('h1, h2')
      )) || null;

    var thName = container ? container.querySelector('th.ve-stats__th-name[data-name]') : null;
    var title =
      (rawEntity && (rawEntity._displayName || rawEntity.name)) ||
      (thName && thName.getAttribute('data-name')) ||
      (nameEl && (nameEl.textContent || '').trim()) ||
      '';

    if (!title) return null;

    var sourceEl =
      container &&
      (container.querySelector('.ve-stats__h-source-abbreviation') ||
        container.querySelector('.stats-source'));
    var source =
      (rawEntity && rawEntity.source) ||
      (thName && thName.getAttribute('data-source')) ||
      (sourceEl ? (sourceEl.textContent || '').trim() : '') ||
      'PHB';

    var htmlPayload = '';
    if (classTable && (classTable.innerText || '').trim().length > 20) {
      htmlPayload += classTable.outerHTML + '\\n';
    }
    if (container) {
      htmlPayload += container.outerHTML;
    }

    var activeSubNames = '';
    if (clonedEntity && clonedEntity._shardforgeType === 'class' && Array.isArray(clonedEntity.activeSubclasses)) {
      activeSubNames = clonedEntity.activeSubclasses.map(function (s) { return s.shortName || s.name; }).join(',');
    }

    return {
      title: title,
      source: source,
      pageFile: pageFile,
      hash: window.location.hash || '',
      html: htmlPayload,
      entityJson: clonedEntity,
      signature: pageFile + '|' + window.location.hash + '|' + title + '|' + source + '|' + activeSubNames + '|' + textLen
    };
  }

  function ensureFloatingBar(entry) {
    var bar = document.getElementById('shardforge-floating-bar');
    if (!entry) {
      if (bar) bar.style.display = 'none';
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'shardforge-floating-bar';
      bar.innerHTML =
        '<span class="sf-title" id="sf-bar-title"></span>' +
        '<button type="button" class="sf-btn sf-btn-queue" id="sf-bar-queue">+ Add to Book</button>' +
        '<button type="button" class="sf-btn sf-btn-convert" id="sf-bar-convert">Download .docx</button>';
      document.body.appendChild(bar);

      document.getElementById('sf-bar-convert').addEventListener('click', function () {
        var current = extractActiveEntry();
        if (current && window.parent !== window) {
          window.parent.postMessage({ type: 'SHARDFORGE_CONVERT_NOW', payload: current }, '*');
        }
      });

      document.getElementById('sf-bar-queue').addEventListener('click', function () {
        var current = extractActiveEntry();
        if (current && window.parent !== window) {
          window.parent.postMessage({ type: 'SHARDFORGE_ADD_QUEUE', payload: current }, '*');
        }
      });
    }

    bar.style.display = 'flex';
    var titleSpan = document.getElementById('sf-bar-title');
    if (titleSpan) titleSpan.textContent = entry.title;

    var queueBtn = document.getElementById('sf-bar-queue');
    if (queueBtn) {
      queueBtn.textContent = isQueuedState ? 'In Book Queue' : '+ Add to Book';
      if (isQueuedState) queueBtn.classList.add('is-queued');
      else queueBtn.classList.remove('is-queued');
    }
  }

  function syncToParent(force) {
    var entry = extractActiveEntry();
    ensureFloatingBar(entry);
    if (!entry) return;
    if (!force && entry.signature === lastSignature) return;
    lastSignature = entry.signature;
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'SHARDFORGE_ENTRY_SYNC', payload: entry }, '*');
    }
  }

  var syncTimer = null;
  function scheduleSync(force) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncToParent(force);
    }, 150);
  }

  function startObserver() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'SHARDFORGE_PAGE_LOADED', pageFile: detectPageFile() }, '*');
    }
    var observer = new MutationObserver(function () {
      scheduleSync(false);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    window.addEventListener('hashchange', function () {
      scheduleSync(true);
    });
    document.addEventListener('click', function () {
      scheduleSync(false);
    });
    scheduleSync(true);
  }

  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'SHARDFORGE_REQUEST_SYNC') {
      syncToParent(true);
    } else if (event.data.type === 'SHARDFORGE_QUEUE_STATUS') {
      isQueuedState = Boolean(event.data.isQueued);
      var entry = extractActiveEntry();
      ensureFloatingBar(entry);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
</script>`;
}

async function handle5eToolsSiteProxy(
  req: express.Request,
  res: express.Response,
  mirrorKey: 'latest' | 'classic2014',
  mountPrefix: string
) {
  const relPath = req.path.replace(/^\/+/, '');

  if (!relPath) {
    res.redirect(302, `${mountPrefix}/bestiary.html`);
    return;
  }

  if (relPath.includes('..')) {
    res.status(400).send('Invalid path');
    return;
  }

  if (relPath === 'sw-injector.js' || relPath === 'sw.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send('/* ShardForge: service worker disabled inside embedded converter */');
    return;
  }

  const isHtml = relPath.endsWith('.html') || relPath.endsWith('.htm');
  const cacheKey = `${mirrorKey}:v3:${relPath}`;
  const cached = siteAssetCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader(
      'Cache-Control',
      isHtml ? 'no-store, no-cache, must-revalidate' : 'public, max-age=300'
    );
    res.send(cached.body);
    return;
  }

  const baseUrl = SITE_MIRRORS[mirrorKey];
  const targetUrl = `${baseUrl}/${relPath}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ShardForge-5eTools-Proxy/1.0',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(response.status).send(`5eTools mirror returned HTTP ${response.status} for ${relPath}`);
      return;
    }

    const contentType = getMimeType(relPath);
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    if (isHtml) {
      let html = buffer.toString('utf-8');
      const bridgeHtml = buildInjectedBridgeHtml();
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${bridgeHtml}</body>`);
      } else {
        html += bridgeHtml;
      }
      buffer = Buffer.from(html, 'utf-8');
    }

    if (siteAssetCache.size >= MAX_SITE_CACHE_ENTRIES) {
      const oldestKey = siteAssetCache.keys().next().value;
      if (oldestKey) siteAssetCache.delete(oldestKey);
    }
    siteAssetCache.set(cacheKey, {
      timestamp: Date.now(),
      contentType,
      body: buffer,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      isHtml ? 'no-store, no-cache, must-revalidate' : 'public, max-age=300'
    );
    res.send(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).send(`Failed to proxy 5eTools asset (${relPath}): ${msg}`);
  }
}

app.use('/5etools-site', (req, res) => {
  handle5eToolsSiteProxy(req, res, 'latest', '/5etools-site');
});

app.use('/5etools-site-2014', (req, res) => {
  handle5eToolsSiteProxy(req, res, 'classic2014', '/5etools-site-2014');
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShardForge server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
