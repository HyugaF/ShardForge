import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Columns2,
  Download,
  ExternalLink,
  Maximize2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { NormalizedEntry } from '../types/converter';

export interface FiveEToolsPageOption {
  id: string;
  label: string;
  file: string;
}

export const FIVETOOLS_PAGES: FiveEToolsPageOption[] = [
  { id: 'bestiary', label: 'Bestiary', file: 'bestiary.html' },
  { id: 'spells', label: 'Spells', file: 'spells.html' },
  { id: 'items', label: 'Items', file: 'items.html' },
  { id: 'classes', label: 'Classes', file: 'classes.html' },
  { id: 'feats', label: 'Feats', file: 'feats.html' },
  { id: 'races', label: 'Races', file: 'races.html' },
  { id: 'backgrounds', label: 'Backgrounds', file: 'backgrounds.html' },
  { id: 'adventures', label: 'Adventures', file: 'adventures.html' },
  { id: 'books', label: 'Books', file: 'books.html' },
];

export interface LiveBridgePayload {
  title: string;
  source: string;
  pageFile: string;
  hash: string;
  html: string;
  entityJson?: Record<string, any> | null;
  signature: string;
}

interface LiveFiveEToolsFrameProps {
  activePageFile: string;
  onChangePageFile: (file: string) => void;
  ruleset: 'latest' | 'classic2014';
  onChangeRuleset: (ruleset: 'latest' | 'classic2014') => void;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
  syncedEntry: NormalizedEntry | null;
  isQueued: boolean;
  onSyncFromBridge: (payload: LiveBridgePayload) => void;
  onBridgeConvertNow: (payload: LiveBridgePayload) => void;
  onBridgeToggleQueue: (payload: LiveBridgePayload) => void;
  onInstantConvertSynced: () => void;
  onToggleQueueSynced: () => void;
}

export const LiveFiveEToolsFrame: React.FC<LiveFiveEToolsFrameProps> = ({
  activePageFile,
  onChangePageFile,
  ruleset,
  onChangeRuleset,
  isFullWidth,
  onToggleFullWidth,
  syncedEntry,
  isQueued,
  onSyncFromBridge,
  onBridgeConvertNow,
  onBridgeToggleQueue,
  onInstantConvertSynced,
  onToggleQueueSynced,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [highlightedPage, setHighlightedPage] = useState<string>(activePageFile);

  const mountPrefix = ruleset === 'classic2014' ? '/5etools-site-2014' : '/5etools-site';
  const iframeSrc = `${mountPrefix}/${activePageFile}?v=3${reloadNonce > 0 ? `&r=${reloadNonce}` : ''}`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data as {
        type?: string;
        pageFile?: string;
        payload?: LiveBridgePayload;
      };

      if (data.type === 'SHARDFORGE_PAGE_LOADED' && data.pageFile) {
        setHighlightedPage(data.pageFile);
        return;
      }

      const payload = data.payload;
      if (!payload || (!payload.html && !payload.entityJson)) return;

      if (payload.pageFile) {
        setHighlightedPage(payload.pageFile);
      }

      if (data.type === 'SHARDFORGE_ENTRY_SYNC') {
        onSyncFromBridge(payload);
      } else if (data.type === 'SHARDFORGE_CONVERT_NOW') {
        onBridgeConvertNow(payload);
      } else if (data.type === 'SHARDFORGE_ADD_QUEUE') {
        onBridgeToggleQueue(payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSyncFromBridge, onBridgeConvertNow, onBridgeToggleQueue]);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ type: 'SHARDFORGE_QUEUE_STATUS', isQueued }, '*');
    } catch {
      // Ignore if iframe not ready
    }
  }, [isQueued, syncedEntry?.id]);

  useEffect(() => {
    setHighlightedPage(activePageFile);
    setIsLoading(true);
  }, [activePageFile, ruleset, reloadNonce]);

  const handleToolbarPageClick = (file: string) => {
    setHighlightedPage(file);
    if (file === activePageFile) {
      setReloadNonce((n) => n + 1);
    } else {
      onChangePageFile(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#14161B] border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
      {/* Compact 5eTools Section Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6] dark:bg-[#14161B]">
        <div className="flex items-center gap-1 overflow-x-auto max-w-full">
          {FIVETOOLS_PAGES.map((pg) => {
            const isActive = highlightedPage === pg.file;
            return (
              <button
                key={pg.id}
                type="button"
                onClick={() => handleToolbarPageClick(pg.file)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                {pg.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={ruleset}
            onChange={(e) => onChangeRuleset(e.target.value as 'latest' | 'classic2014')}
            aria-label="5eTools Edition"
            className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 cursor-pointer"
          >
            <option value="classic2014">2014 Ruleset</option>
            <option value="latest">2024 / Latest</option>
          </select>

          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            title="Reload 5eTools Page"
            aria-label="Reload 5eTools Page"
            className="p-1.5 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleFullWidth}
            title={isFullWidth ? 'Show Split Preview' : 'Expand 5eTools Full Width'}
            aria-label={isFullWidth ? 'Show Split Preview' : 'Expand 5eTools Full Width'}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullWidth ? <Columns2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullWidth ? 'Split View' : 'Expand'}</span>
          </button>

          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            title="Open 5eTools Page in New Tab"
            aria-label="Open 5eTools Page in New Tab"
            className="p-1.5 text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Active Website Selection & 1-Click Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161B]">
        {syncedEntry ? (
          <>
            <div className="min-w-0 flex items-center gap-2 text-xs">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {syncedEntry.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 font-code tabular-nums whitespace-nowrap">
                · {syncedEntry.category.toUpperCase()} · {syncedEntry.source}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleQueueSynced}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isQueued
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {isQueued ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                <span>{isQueued ? 'In Book Queue' : 'Add to Book'}</span>
              </button>

              <button
                type="button"
                onClick={onInstantConvertSynced}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 dark:bg-red-700 dark:hover:bg-red-600 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .docx</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Select any Monster, Spell, Item, Class, Feat, Race, or Adventure inside the 5eTools website below to convert it to Shard .docx.
          </p>
        )}
      </div>

      {/* Live 5eTools Website Viewport with Direct Backdrop-Blur + Centered Fade-In Logo */}
      <div className="relative flex-1 bg-white dark:bg-zinc-950 min-h-0 overflow-hidden">
        <div
          aria-hidden={!isLoading}
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-md bg-[#F6F5F2]/45 dark:bg-[#0C0D10]/50 text-center p-6 transition-opacity duration-500 ${
            isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {isLoading && (
            <div className="flex flex-col items-center animate-sf-logo-in">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shadow-sm mb-2.5 border border-zinc-800 dark:border-zinc-300">
                <svg
                  viewBox="0 0 36 36"
                  fill="none"
                  className="w-7 h-7"
                  aria-hidden="true"
                >
                  <path
                    d="M18 3L30 10.5V25.5L18 33L6 25.5V10.5L18 3Z"
                    stroke="#DC2626"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18 3L24 15L18 33L12 15L18 3Z"
                    fill="#991B1B"
                    fillOpacity="0.35"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-white dark:text-zinc-900"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 10.5L18 15L30 10.5M6 25.5L18 21L30 25.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeOpacity="0.65"
                    className="text-white dark:text-zinc-900"
                  />
                </svg>
              </div>

              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-display">
                ShardForge
              </span>
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-code mt-0.5">
                Loading {activePageFile.replace('.html', '')}...
              </span>

              <div className="w-28 h-0.5 bg-zinc-300/90 dark:bg-zinc-700 rounded-full overflow-hidden mt-3">
                <div className="w-full h-full bg-red-800 dark:bg-red-600 animate-sf-progress" />
              </div>
            </div>
          )}
        </div>

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Live 5eTools Website"
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0 block"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </div>
    </div>
  );
};
