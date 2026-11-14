import React, { useState } from 'react';
import {
  Check,
  Download,
  FileText,
  Plus,
} from 'lucide-react';
import {
  CategoryType,
  DocBlock,
  HeadingDepth,
  NormalizedEntry,
  ShardFormattingConfig,
  TextSpan,
} from '../types/converter';
import { formatModifier } from '../utils/tagParser';

interface DocxPreviewSheetProps {
  entry: NormalizedEntry | null;
  config: ShardFormattingConfig;
  isQueued: boolean;
  onInstantConvert: (entry: NormalizedEntry) => void;
  onToggleQueue: (entry: NormalizedEntry) => void;
}

const CATEGORY_PLURAL_TITLES: Record<CategoryType, string> = {
  monster: 'Monsters & NPCs',
  spell: 'Spells',
  item: 'Magic Items & Equipment',
  feat: 'Feats',
  class: 'Classes',
  subclass: 'Subclasses',
  race: 'Races & Lineages',
  background: 'Backgrounds',
  adventure: 'Adventure & Sourcebook Chapters',
};

function renderSpans(spans: TextSpan[]): React.ReactNode {
  return spans.map((s, idx) => {
    let content: React.ReactNode = s.text;
    if (s.bold && s.italic) {
      content = <strong key={idx} className="font-bold italic">{content}</strong>;
    } else if (s.bold) {
      content = <strong key={idx} className="font-semibold">{content}</strong>;
    } else if (s.italic) {
      content = <em key={idx} className="italic">{content}</em>;
    }
    return <React.Fragment key={idx}>{content}</React.Fragment>;
  });
}

export const DocxPreviewSheet: React.FC<DocxPreviewSheetProps> = ({
  entry,
  config,
  isQueued,
  onInstantConvert,
  onToggleQueue,
}) => {
  const [previewTab, setPreviewTab] = useState<'docx-sheet' | 'heading-tree' | 'tag-audit'>('docx-sheet');

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10 text-center bg-white dark:bg-[#14161B] border border-zinc-200 dark:border-zinc-800 rounded-md">
        <FileText className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mb-3" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Waiting for Selection on 5eTools
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
          Click any Monster, Spell, Item, Class, Feat, Race, or Adventure inside the live 5eTools website on the left. Its formatted Shard Tabletop .docx document will appear here immediately.
        </p>
      </div>
    );
  }

  const effectiveEntryHeading: HeadingDepth =
    config.presetMode === 'single-convert' ? 'H1' : config.entryHeadingLevel;
  const effectiveSubHeading: HeadingDepth =
    config.presetMode === 'single-convert' ? 'H2' : config.subsectionHeadingLevel;

  const headingNodes = entry.blocks.filter(
    (b): b is Extract<DocBlock, { type: 'heading' }> => b.type === 'heading'
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#14161B] border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
      {/* Consolidated Entry Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-[#FAF9F6] dark:bg-[#14161B]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-code tabular-nums">
            <span>{entry.category.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>{entry.source}{entry.page ? ` p.${entry.page}` : ''}</span>
            <span aria-hidden="true">·</span>
            <span>{entry.tagTransformations.length} tags cleaned</span>
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
            {entry.name}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleQueue(entry)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isQueued
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {isQueued ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isQueued ? 'In Book Queue' : 'Add to Book'}</span>
          </button>

          <button
            type="button"
            onClick={() => onInstantConvert(entry)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 dark:bg-red-700 dark:hover:bg-red-600 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .docx</span>
          </button>
        </div>
      </div>

      {/* Clean Inspection Mode Selector */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161B]">
        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded">
          <button
            type="button"
            onClick={() => setPreviewTab('docx-sheet')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              previewTab === 'docx-sheet'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Manuscript
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('heading-tree')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer font-code tabular-nums ${
              previewTab === 'heading-tree'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Heading Map ({headingNodes.length + 1})
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('tag-audit')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer font-code tabular-nums ${
              previewTab === 'tag-audit'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Cleaned Tags ({entry.tagTransformations.length})
          </button>
        </div>

        <span className="hidden sm:inline text-xs font-code text-zinc-500 dark:text-zinc-400 tabular-nums">
          Word {effectiveEntryHeading} → {effectiveSubHeading}
        </span>
      </div>

      {/* Main Scrollable Document Stage */}
      <div className="flex-1 overflow-y-auto p-5 bg-[#F6F5F2] dark:bg-[#0C0D10]">
        {previewTab === 'docx-sheet' && (
          <div className="max-w-3xl mx-auto bg-[#FCFBF8] dark:bg-[#181A20] border border-zinc-200 dark:border-zinc-800 rounded-xs p-7 sm:p-9 font-book text-zinc-900 dark:text-zinc-100">
            {config.presetMode !== 'single-convert' && config.includeCategoryChapterHeading && (
              <div className="mb-5 pb-3 border-b border-dashed border-zinc-300 dark:border-zinc-700">
                <span className="text-[11px] font-code text-red-800 dark:text-red-400">
                  Word {config.categoryHeadingLevel} · Shard Book Chapter
                </span>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {CATEGORY_PLURAL_TITLES[entry.category]}
                </h1>
              </div>
            )}

            <div className="mb-2">
              <span className="text-[11px] font-code text-red-800 dark:text-red-400">
                Word {effectiveEntryHeading} · Shard {entry.badgeCode} Entry
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-0.5">
                {entry.name}
              </h2>
              {config.includeSourceCitations && entry.source && (
                <p className="text-xs italic text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Source: {entry.source}{entry.page ? `, p. ${entry.page}` : ''}
                </p>
              )}
            </div>

            <div className="space-y-2.5 text-[15px] leading-relaxed">
              {entry.blocks.map((block, idx) => {
                switch (block.type) {
                  case 'subtitle':
                    return (
                      <p key={idx} className="italic text-zinc-700 dark:text-zinc-300">
                        {block.text}
                      </p>
                    );

                  case 'divider':
                    return (
                      <hr
                        key={idx}
                        className="my-3 border-t border-zinc-300 dark:border-zinc-700"
                      />
                    );

                  case 'key-value':
                    return (
                      <p key={idx} className="leading-snug">
                        <strong className="font-bold text-zinc-900 dark:text-zinc-100">
                          {block.label}{' '}
                        </strong>
                        <span>{block.value}</span>
                      </p>
                    );

                  case 'ability-array': {
                    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
                    if (config.abilityScoreFormat === 'table-6col') {
                      return (
                        <div key={idx} className="my-3 overflow-x-auto">
                          <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700 text-center text-sm font-code tabular-nums">
                            <thead>
                              <tr className="bg-zinc-100 dark:bg-zinc-800">
                                {keys.map((k) => (
                                  <th
                                    key={k}
                                    className="border border-zinc-300 dark:border-zinc-700 py-1.5 px-2 font-bold text-zinc-800 dark:text-zinc-200"
                                  >
                                    {k.toUpperCase()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {keys.map((k) => {
                                  const score = block.scores[k];
                                  return (
                                    <td
                                      key={k}
                                      className="border border-zinc-300 dark:border-zinc-700 py-1.5 px-2 text-zinc-900 dark:text-zinc-100"
                                    >
                                      {score} ({formatModifier(score)})
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return (
                      <p key={idx} className="py-1.5 font-semibold font-code text-sm tabular-nums">
                        {keys
                          .map((k) => `${k.toUpperCase()} ${block.scores[k]} (${formatModifier(block.scores[k])})`)
                          .join('   ·   ')}
                      </p>
                    );
                  }

                  case 'heading': {
                    const levelToUse =
                      block.shardRole === 'subsection' ? effectiveSubHeading : block.level;
                    return (
                      <div key={idx} className="pt-4 pb-1 border-b border-zinc-300 dark:border-zinc-700">
                        <span className="block text-[11px] font-code text-red-800 dark:text-red-400">
                          Word {levelToUse}
                        </span>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {block.text}
                        </h3>
                      </div>
                    );
                  }

                  case 'feature-item':
                    return (
                      <p key={idx} className="pt-1">
                        <strong className="font-bold italic text-zinc-900 dark:text-zinc-100">
                          {block.name}.{' '}
                        </strong>
                        {renderSpans(block.spans)}
                      </p>
                    );

                  case 'paragraph':
                    return <p key={idx}>{renderSpans(block.spans)}</p>;

                  case 'list':
                    return (
                      <ul key={idx} className="list-disc pl-6 space-y-1">
                        {block.items.map((itemSpans, liIdx) => (
                          <li key={liIdx}>{renderSpans(itemSpans)}</li>
                        ))}
                      </ul>
                    );

                  case 'inset':
                    return (
                      <div
                        key={idx}
                        className="my-3 p-4 border border-zinc-300 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-800/50 rounded-xs space-y-1.5"
                      >
                        {block.title && (
                          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                            {block.title}
                          </p>
                        )}
                        {block.paragraphs.map((pSpans, pIdx) => (
                          <p key={pIdx} className="text-sm italic text-zinc-800 dark:text-zinc-200">
                            {renderSpans(pSpans)}
                          </p>
                        ))}
                      </div>
                    );

                  case 'table':
                    return (
                      <div key={idx} className="my-3 overflow-x-auto">
                        {block.table.caption && (
                          <p className="font-bold italic text-sm mb-1.5">{block.table.caption}</p>
                        )}
                        <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700 text-sm">
                          {block.table.headers.length > 0 && (
                            <thead>
                              <tr className="bg-zinc-100 dark:bg-zinc-800">
                                {block.table.headers.map((h, hIdx) => (
                                  <th
                                    key={hIdx}
                                    className="border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-left font-bold"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {block.table.rows.map((r, rIdx) => (
                              <tr key={rIdx}>
                                {r.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 tabular-nums"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );

                  default:
                    return null;
                }
              })}
            </div>
          </div>
        )}

        {previewTab === 'heading-tree' && (
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#14161B] border border-zinc-200 dark:border-zinc-800 rounded-xs p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Word Heading Outline for Shard Tabletop
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Shard Tabletop uses Word heading depths to separate chapters, entries, and mechanical subsections (Actions, Bonus Actions, Reactions, Legendary Actions, Class Features).
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xs font-code text-xs">
              {config.presetMode !== 'single-convert' && config.includeCategoryChapterHeading && (
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-red-800 dark:text-red-400">
                      {config.categoryHeadingLevel}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {CATEGORY_PLURAL_TITLES[entry.category]}
                    </span>
                  </div>
                  <span className="text-zinc-500">Book Chapter</span>
                </div>
              )}

              <div className="flex items-center justify-between px-3.5 py-2.5 pl-6">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-red-800 dark:text-red-400">
                    {effectiveEntryHeading}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {entry.name}
                  </span>
                </div>
                <span className="text-zinc-500">
                  {entry.badgeCode} Entry Root
                </span>
              </div>

              {headingNodes.map((hNode, idx) => {
                const levelToUse =
                  hNode.shardRole === 'subsection' ? effectiveSubHeading : hNode.level;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2 pl-10"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-zinc-600 dark:text-zinc-400">
                        {levelToUse}
                      </span>
                      <span className="text-zinc-800 dark:text-zinc-200">{hNode.text}</span>
                    </div>
                    <span className="text-zinc-500">Subsection</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {previewTab === 'tag-audit' && (
          <div className="max-w-3xl mx-auto bg-white dark:bg-[#14161B] border border-zinc-200 dark:border-zinc-800 rounded-xs p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                5eTools Tag & Dice Notation Cleanup
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Inline 5eTools tags resolved into plain 5e SRD text for Shard Tabletop&apos;s parser.
              </p>
            </div>

            {entry.tagTransformations.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">
                No inline &#123;@tag&#125; expressions needed conversion in this entry.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-code tabular-nums">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                      <th className="py-2 pr-3 font-medium">Tag</th>
                      <th className="py-2 px-3 font-medium">5eTools Source</th>
                      <th className="py-2 pl-3 font-medium">Shard DOCX Text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {entry.tagTransformations.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-3 text-red-800 dark:text-red-400 font-semibold">
                          {item.tagType}
                        </td>
                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                          {item.rawTag}
                        </td>
                        <td className="py-2 pl-3 text-zinc-900 dark:text-zinc-100 font-medium">
                          {item.resolvedText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
