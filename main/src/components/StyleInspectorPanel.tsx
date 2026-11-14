import React from 'react';
import {
  BookOpen,
  Download,
  Trash2,
  X,
} from 'lucide-react';
import {
  HeadingDepth,
  NormalizedEntry,
  ShardFormattingConfig,
} from '../types/converter';

interface StyleInspectorPanelProps {
  config: ShardFormattingConfig;
  onChangeConfig: (updater: (prev: ShardFormattingConfig) => ShardFormattingConfig) => void;
  queuedEntries: NormalizedEntry[];
  onSelectEntry: (entry: NormalizedEntry) => void;
  onRemoveFromQueue: (id: string) => void;
  onClearQueue: () => void;
  onExportQueuedBook: () => void;
  activeRightTab: 'queue' | 'mapping' | 'guide';
  onChangeRightTab: (tab: 'queue' | 'mapping' | 'guide') => void;
  onBackToPreview: () => void;
}

const HEADING_OPTIONS: HeadingDepth[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

export const StyleInspectorPanel: React.FC<StyleInspectorPanelProps> = ({
  config,
  onChangeConfig,
  queuedEntries,
  onSelectEntry,
  onRemoveFromQueue,
  onClearQueue,
  onExportQueuedBook,
  activeRightTab,
  onChangeRightTab,
  onBackToPreview,
}) => {
  const handlePresetChange = (mode: ShardFormattingConfig['presetMode']) => {
    onChangeConfig((prev) => {
      if (mode === 'single-convert') {
        return {
          ...prev,
          presetMode: 'single-convert',
          includeCategoryChapterHeading: false,
          entryHeadingLevel: 'H1',
          subsectionHeadingLevel: 'H2',
          featureHeadingLevel: 'H3',
        };
      }
      if (mode === 'batch-convert-children') {
        return {
          ...prev,
          presetMode: 'batch-convert-children',
          includeCategoryChapterHeading: true,
          categoryHeadingLevel: 'H1',
          entryHeadingLevel: 'H2',
          subsectionHeadingLevel: 'H3',
          featureHeadingLevel: 'H4',
        };
      }
      return {
        ...prev,
        presetMode: 'custom-hierarchy',
      };
    });
  };

  return (
    <aside className="flex flex-col h-full bg-white dark:bg-[#14161B] border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6] dark:bg-[#14161B]">
        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded">
          <button
            type="button"
            onClick={() => onChangeRightTab('queue')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer font-code tabular-nums ${
              activeRightTab === 'queue'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Book Queue ({queuedEntries.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeRightTab('mapping')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeRightTab === 'mapping'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Heading Styles
          </button>
          <button
            type="button"
            onClick={() => onChangeRightTab('guide')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeRightTab === 'guide'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Import Guide
          </button>
        </div>

        <button
          type="button"
          onClick={onBackToPreview}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
        >
          Back to Manuscript
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeRightTab === 'queue' && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="book-title-input"
                className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5"
              >
                Exported Book Title
              </label>
              <input
                id="book-title-input"
                type="text"
                value={config.bookTitle}
                onChange={(e) =>
                  onChangeConfig((prev) => ({ ...prev, bookTitle: e.target.value }))
                }
                placeholder="e.g. Campaign Compendium"
                className="w-full px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-code tabular-nums">
                Queued Website Entries ({queuedEntries.length})
              </span>
              {queuedEntries.length > 0 && (
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-700 dark:hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {queuedEntries.length === 0 ? (
              <div className="py-10 px-6 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded">
                <BookOpen className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  No Entries in Book Queue
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Browse the live 5eTools website on the left and click &quot;Add to Book&quot; on any Monster, Spell, Item, or Class to combine them into a single Shard .docx book.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
                {queuedEntries.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-[#14161B] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectEntry(item)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-code tabular-nums truncate">
                        {item.category.toUpperCase()} · {item.source}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(item.id)}
                      className="p-1 text-zinc-400 hover:text-red-700 dark:hover:text-red-400 rounded cursor-pointer"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onExportQueuedBook}
              disabled={queuedEntries.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 dark:bg-red-700 dark:hover:bg-red-600 disabled:opacity-40 disabled:pointer-events-none rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Book ({queuedEntries.length}) (.docx)</span>
            </button>
          </div>
        )}

        {activeRightTab === 'mapping' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Shard Tabletop Structure Preset
              </h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handlePresetChange('batch-convert-children')}
                  className={`w-full text-left p-3 rounded border text-xs transition-colors cursor-pointer ${
                    config.presetMode === 'batch-convert-children'
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Multi-Entry Chapter (&quot;Convert Children&quot;)
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    H1 Category Chapter → H2 Entry Title → H3 Subsections.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('single-convert')}
                  className={`w-full text-left p-3 rounded border text-xs transition-colors cursor-pointer ${
                    config.presetMode === 'single-convert'
                      ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Single Standalone Entry (&quot;Convert&quot;)
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    H1 Entry Title → H2 Actions & Features.
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Word Heading Levels
              </h4>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="cat-heading-select" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Category Chapter
                </label>
                <select
                  id="cat-heading-select"
                  value={config.categoryHeadingLevel}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      presetMode: 'custom-hierarchy',
                      categoryHeadingLevel: e.target.value as HeadingDepth,
                    }))
                  }
                  className="px-2.5 py-1 text-xs font-code rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {HEADING_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      Word {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="entry-heading-select" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Entry Title
                </label>
                <select
                  id="entry-heading-select"
                  value={config.entryHeadingLevel}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      presetMode: 'custom-hierarchy',
                      entryHeadingLevel: e.target.value as HeadingDepth,
                    }))
                  }
                  className="px-2.5 py-1 text-xs font-code rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {HEADING_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      Word {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="sub-heading-select" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Subsections (Actions/Traits)
                </label>
                <select
                  id="sub-heading-select"
                  value={config.subsectionHeadingLevel}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      presetMode: 'custom-hierarchy',
                      subsectionHeadingLevel: e.target.value as HeadingDepth,
                    }))
                  }
                  className="px-2.5 py-1 text-xs font-code rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {HEADING_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      Word {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Document Formatting
              </h4>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="ability-layout-select" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Ability Scores
                </label>
                <select
                  id="ability-layout-select"
                  value={config.abilityScoreFormat}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      abilityScoreFormat: e.target.value as ShardFormattingConfig['abilityScoreFormat'],
                    }))
                  }
                  className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="table-6col">6-Column Word Table</option>
                  <option value="inline-compact">Inline Row</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="font-family-select" className="text-xs text-zinc-600 dark:text-zinc-400">
                  Word Font Family
                </label>
                <select
                  id="font-family-select"
                  value={config.fontFamily}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      fontFamily: e.target.value as ShardFormattingConfig['fontFamily'],
                    }))
                  }
                  className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Cambria">Cambria</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Calibri">Calibri</option>
                </select>
              </div>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  Include Dice Averages
                </span>
                <input
                  type="checkbox"
                  checked={config.includeDiceAverages}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      includeDiceAverages: e.target.checked,
                    }))
                  }
                  className="rounded border-zinc-300 text-red-800"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  Include Source Citations
                </span>
                <input
                  type="checkbox"
                  checked={config.includeSourceCitations}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      includeSourceCitations: e.target.checked,
                    }))
                  }
                  className="rounded border-zinc-300 text-red-800"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  Page Break Between Entries
                </span>
                <input
                  type="checkbox"
                  checked={config.pageBreakBetweenEntries}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      pageBreakBetweenEntries: e.target.checked,
                    }))
                  }
                  className="rounded border-zinc-300 text-red-800"
                />
              </label>
            </div>
          </div>
        )}

        {activeRightTab === 'guide' && (
          <div className="space-y-4 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-1">
                Importing into Shard Tabletop
              </h3>
              <p>
                Shard Tabletop imports Word (`.docx`) files and uses heading levels (`H1`, `H2`, `H3`) to construct chapters and convert entries into playable 5e mechanics.
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-b border-zinc-200 dark:border-zinc-800">
              <div className="py-3 space-y-1">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  01. Import the .docx File
                </p>
                <p>
                  In Shard Tabletop, open <strong>Library</strong> → <strong>New Book</strong> → <strong>Import Book</strong>, and choose the `.docx` file downloaded from ShardForge.
                </p>
              </div>

              <div className="py-3 space-y-1">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  02. Convert Single Entries (&quot;Convert&quot;)
                </p>
                <p>
                  Open the imported book in <strong>Edit Mode</strong>, click the menu icon next to a Monster, Spell, Item, or Class heading, and click <strong>Convert</strong>.
                </p>
              </div>

              <div className="py-3 space-y-1">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  03. Convert Multi-Entry Chapters (&quot;Convert Children&quot;)
                </p>
                <p>
                  For multi-entry books exported from your Book Queue, click the menu icon next to the `H1` chapter heading (e.g., <em>Monsters &amp; NPCs</em> or <em>Spells</em>) and choose <strong>Convert Children</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
