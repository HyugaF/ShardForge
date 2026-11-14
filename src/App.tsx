/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { DocxPreviewSheet } from './components/DocxPreviewSheet';
import { LiveBridgePayload, LiveFiveEToolsFrame } from './components/LiveFiveEToolsFrame';
import { StyleInspectorPanel } from './components/StyleInspectorPanel';
import {
  NormalizedEntry,
  ShardFormattingConfig,
} from './types/converter';
import { exportEntriesToShardDocx } from './utils/docxGenerator';
import { parse5eToolsWebsiteHtmlOrText } from './utils/fiveEToolsParser';

const DEFAULT_CONFIG: ShardFormattingConfig = {
  presetMode: 'batch-convert-children',
  bookTitle: 'ShardForge 5e Compendium',
  includeCategoryChapterHeading: true,
  categoryHeadingLevel: 'H1',
  entryHeadingLevel: 'H2',
  subsectionHeadingLevel: 'H3',
  featureHeadingLevel: 'H4',
  abilityScoreFormat: 'table-6col',
  includeSourceCitations: true,
  includeDiceAverages: true,
  readAloudBorderStyle: 'shaded-box',
  pageBreakBetweenEntries: false,
  fontFamily: 'Cambria',
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isFullWidthWebsite, setIsFullWidthWebsite] = useState<boolean>(false);
  const [config, setConfig] = useState<ShardFormattingConfig>(DEFAULT_CONFIG);

  // Full-screen entrance blur + centered logo fade-in animation state
  const [introPhase, setIntroPhase] = useState<'entering' | 'fading-out' | 'done'>('entering');

  // Pure Live 5eTools Website state (zero offline templates)
  const [livePageFile, setLivePageFile] = useState<string>('bestiary.html');
  const [liveRuleset, setLiveRuleset] = useState<'latest' | 'classic2014'>('classic2014');
  const [liveSyncedEntry, setLiveSyncedEntry] = useState<NormalizedEntry | null>(null);
  const [sessionWebsiteEntries, setSessionWebsiteEntries] = useState<NormalizedEntry[]>([]);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);

  // Right pane view controlled directly from the top navigation bar
  const [rightPaneView, setRightPaneView] = useState<'preview' | 'queue' | 'mapping' | 'guide'>('preview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIntroPhase((prev) => (prev === 'entering' ? 'fading-out' : prev));
    }, 1150);
    const doneTimer = setTimeout(() => {
      setIntroPhase('done');
    }, 1650);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  const queuedEntries = useMemo(
    () =>
      queuedIds
        .map((id) => sessionWebsiteEntries.find((e) => e.id === id))
        .filter((e): e is NormalizedEntry => Boolean(e)),
    [queuedIds, sessionWebsiteEntries]
  );

  const handleInstantConvert = useCallback(
    async (entry: NormalizedEntry) => {
      try {
        const singleConfig: ShardFormattingConfig = {
          ...config,
          presetMode: 'single-convert',
          includeCategoryChapterHeading: false,
        };
        const fileName = await exportEntriesToShardDocx([entry], singleConfig, entry.name);
        showToast(`Downloaded ${fileName}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'DOCX conversion failed');
      }
    },
    [config, showToast]
  );

  const handlePrimaryExportAction = async () => {
    if (queuedEntries.length > 0) {
      try {
        const fileName = await exportEntriesToShardDocx(queuedEntries, config);
        showToast(`Exported ${queuedEntries.length} entries to ${fileName}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'DOCX export failed');
      }
      return;
    }

    if (liveSyncedEntry) {
      await handleInstantConvert(liveSyncedEntry);
      return;
    }

    showToast('Select any entry inside the 5eTools website first.');
  };

  const handleToggleQueue = useCallback((entry: NormalizedEntry) => {
    setSessionWebsiteEntries((prev) =>
      prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]
    );
    setQueuedIds((prev) =>
      prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
    );
  }, []);

  const parseBridgePayload = useCallback(
    (payload: LiveBridgePayload): NormalizedEntry | null => {
      const parsed = parse5eToolsWebsiteHtmlOrText(payload.html, config, {
        pageFile: payload.pageFile,
        title: payload.title,
        source: payload.source,
        hash: payload.hash,
        entityJson: payload.entityJson,
      });
      return parsed[0] || null;
    },
    [config]
  );

  const handleSyncFromBridge = useCallback(
    (payload: LiveBridgePayload) => {
      const entry = parseBridgePayload(payload);
      if (!entry) return;
      setLiveSyncedEntry(entry);
      setSessionWebsiteEntries((prev) => {
        const filtered = prev.filter((p) => p.id !== entry.id);
        return [entry, ...filtered].slice(0, 100);
      });
    },
    [parseBridgePayload]
  );

  const handleBridgeConvertNow = useCallback(
    async (payload: LiveBridgePayload) => {
      const entry = parseBridgePayload(payload);
      if (!entry) {
        showToast('Could not read entry from current 5eTools view.');
        return;
      }
      setLiveSyncedEntry(entry);
      setSessionWebsiteEntries((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, 100));
      await handleInstantConvert(entry);
    },
    [parseBridgePayload, handleInstantConvert, showToast]
  );

  const handleBridgeToggleQueue = useCallback(
    (payload: LiveBridgePayload) => {
      const entry = parseBridgePayload(payload);
      if (!entry) return;
      setLiveSyncedEntry(entry);
      setSessionWebsiteEntries((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, 100));
      setQueuedIds((prev) => {
        const exists = prev.includes(entry.id);
        showToast(exists ? `Removed "${entry.name}" from Book Queue` : `Added "${entry.name}" to Book Queue`);
        return exists ? prev.filter((id) => id !== entry.id) : [...prev, entry.id];
      });
    },
    [parseBridgePayload, showToast]
  );

  const openRightPane = (view: 'preview' | 'queue' | 'mapping' | 'guide') => {
    setIsFullWidthWebsite(false);
    setRightPaneView(view);
  };

  return (
    <div className="relative min-h-dvh flex flex-col bg-[#F6F5F2] dark:bg-[#0C0D10] text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
      {/* Full-Screen Backdrop Blur Overlay with Centered Fade-In Logo */}
      {introPhase !== 'done' && (
        <div
          onClick={() => setIntroPhase('done')}
          aria-hidden="true"
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-[#F6F5F2]/45 dark:bg-[#0C0D10]/50 transition-opacity duration-500 ${
            introPhase === 'fading-out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex flex-col items-center animate-sf-logo-in">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shadow-md mb-3.5 border border-zinc-800 dark:border-zinc-300">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                className="w-9 h-9"
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
                  fillOpacity="0.4"
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

            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-display">
              ShardForge
            </span>
            <span className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 font-medium">
              5eTools to Shard Tabletop .docx Studio
            </span>

            <div className="w-36 h-0.5 bg-zinc-300/90 dark:bg-zinc-700 rounded-full overflow-hidden mt-4">
              <div className="w-full h-full bg-red-800 dark:bg-red-600 animate-sf-progress" />
            </div>
          </div>
        </div>
      )}

      {/* Main Application Shell */}
      <div className="flex-1 flex flex-col">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="flex items-center justify-between gap-8 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161B]">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              openRightPane('preview');
            }}
            className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0"
          >
            ShardForge
          </a>

          {/* Zone 2: 4 Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <a
              href="#preview"
              onClick={(e) => {
                e.preventDefault();
                openRightPane('preview');
              }}
              className={`hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                !isFullWidthWebsite && rightPaneView === 'preview'
                  ? 'text-zinc-900 dark:text-zinc-100 underline underline-offset-8 decoration-2 decoration-red-800 dark:decoration-red-500'
                  : ''
              }`}
            >
              Document Preview
            </a>
            <a
              href="#queue"
              onClick={(e) => {
                e.preventDefault();
                openRightPane('queue');
              }}
              className={`hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 font-code tabular-nums ${
                !isFullWidthWebsite && rightPaneView === 'queue'
                  ? 'text-zinc-900 dark:text-zinc-100 underline underline-offset-8 decoration-2 decoration-red-800 dark:decoration-red-500'
                  : ''
              }`}
            >
              Book Queue ({queuedEntries.length})
            </a>
            <a
              href="#styles"
              onClick={(e) => {
                e.preventDefault();
                openRightPane('mapping');
              }}
              className={`hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                !isFullWidthWebsite && rightPaneView === 'mapping'
                  ? 'text-zinc-900 dark:text-zinc-100 underline underline-offset-8 decoration-2 decoration-red-800 dark:decoration-red-500'
                  : ''
              }`}
            >
              Heading Styles
            </a>
            <a
              href="#guide"
              onClick={(e) => {
                e.preventDefault();
                openRightPane('guide');
              }}
              className={`hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                !isFullWidthWebsite && rightPaneView === 'guide'
                  ? 'text-zinc-900 dark:text-zinc-100 underline underline-offset-8 decoration-2 decoration-red-800 dark:decoration-red-500'
                  : ''
              }`}
            >
              Import Guide
            </a>
          </nav>

          {/* Zone 3: Primary Action + Theme Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handlePrimaryExportAction}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 dark:bg-red-700 dark:hover:bg-red-600 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer font-code tabular-nums"
            >
              {queuedEntries.length > 0
                ? `Export Book (${queuedEntries.length}) (.docx)`
                : liveSyncedEntry
                  ? `Download ${liveSyncedEntry.name} (.docx)`
                  : 'Download Shard .docx'}
            </button>
          </div>
        </header>

        {/* Main Live Workspace Canvas */}
        <main
          id="workspace"
          className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-6 py-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
        >
          {/* Left Pane: Live Embedded 5eTools Website */}
          <section
            className={`${
              isFullWidthWebsite ? 'lg:col-span-12' : 'lg:col-span-7'
            } h-[calc(100dvh-76px)] min-h-[580px]`}
          >
            <LiveFiveEToolsFrame
              activePageFile={livePageFile}
              onChangePageFile={setLivePageFile}
              ruleset={liveRuleset}
              onChangeRuleset={setLiveRuleset}
              isFullWidth={isFullWidthWebsite}
              onToggleFullWidth={() => setIsFullWidthWebsite((f) => !f)}
              syncedEntry={liveSyncedEntry}
              isQueued={liveSyncedEntry ? queuedIds.includes(liveSyncedEntry.id) : false}
              onSyncFromBridge={handleSyncFromBridge}
              onBridgeConvertNow={handleBridgeConvertNow}
              onBridgeToggleQueue={handleBridgeToggleQueue}
              onInstantConvertSynced={() => {
                if (liveSyncedEntry) handleInstantConvert(liveSyncedEntry);
              }}
              onToggleQueueSynced={() => {
                if (liveSyncedEntry) handleToggleQueue(liveSyncedEntry);
              }}
            />
          </section>

          {/* Right Pane: Live Shard DOCX Manuscript / Book Queue / Heading Styles */}
          {!isFullWidthWebsite && (
            <section className="lg:col-span-5 h-[calc(100dvh-76px)] min-h-[580px]">
              {rightPaneView === 'preview' ? (
                <DocxPreviewSheet
                  entry={liveSyncedEntry}
                  config={config}
                  isQueued={liveSyncedEntry ? queuedIds.includes(liveSyncedEntry.id) : false}
                  onInstantConvert={handleInstantConvert}
                  onToggleQueue={handleToggleQueue}
                />
              ) : (
                <StyleInspectorPanel
                  config={config}
                  onChangeConfig={setConfig}
                  queuedEntries={queuedEntries}
                  onSelectEntry={(entry) => {
                    setLiveSyncedEntry(entry);
                    setRightPaneView('preview');
                  }}
                  onRemoveFromQueue={(id) =>
                    setQueuedIds((prev) => prev.filter((item) => item !== id))
                  }
                  onClearQueue={() => setQueuedIds([])}
                  onExportQueuedBook={handlePrimaryExportAction}
                  activeRightTab={rightPaneView}
                  onChangeRightTab={(tab) => setRightPaneView(tab)}
                  onBackToPreview={() => setRightPaneView('preview')}
                />
              )}
            </section>
          )}
        </main>
      </div>

      {/* Non-blocking Confirmation Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-50 px-4 py-2.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-md border border-zinc-700 dark:border-zinc-300"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
