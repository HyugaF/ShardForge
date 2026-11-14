export type CategoryType =
  | 'monster'
  | 'spell'
  | 'item'
  | 'feat'
  | 'class'
  | 'subclass'
  | 'race'
  | 'background'
  | 'adventure';

export type HeadingDepth = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface DocTableData {
  caption?: string;
  headers: string[];
  rows: string[][];
  colAligns?: ('left' | 'center' | 'right')[];
}

export type DocBlock =
  | {
      type: 'heading';
      level: HeadingDepth;
      text: string;
      shardRole?: 'chapter' | 'entry-title' | 'subsection' | 'feature-level';
    }
  | {
      type: 'subtitle';
      text: string;
    }
  | {
      type: 'divider';
    }
  | {
      type: 'key-value';
      label: string;
      value: string;
    }
  | {
      type: 'ability-array';
      scores: AbilityScores;
    }
  | {
      type: 'feature-item';
      name: string;
      spans: TextSpan[];
    }
  | {
      type: 'paragraph';
      spans: TextSpan[];
    }
  | {
      type: 'list';
      items: TextSpan[][];
    }
  | {
      type: 'inset';
      title?: string;
      readAloud?: boolean;
      paragraphs: TextSpan[][];
    }
  | {
      type: 'table';
      table: DocTableData;
    };

export interface TagTransformationSample {
  rawTag: string;
  resolvedText: string;
  tagType: string;
}

export interface NormalizedEntry {
  id: string;
  name: string;
  category: CategoryType;
  source: string;
  page?: number;
  summaryMeta: string;
  badgeCode: string; // e.g. "CR 17", "Lvl 3", "Rare", "Class"
  blocks: DocBlock[];
  rawSourceSnippet: string;
  tagTransformations: TagTransformationSample[];
  originType: '5etools-repo' | 'website-html' | 'custom-json';
}

export interface ShardFormattingConfig {
  presetMode: 'single-convert' | 'batch-convert-children' | 'custom-hierarchy';
  bookTitle: string;
  includeCategoryChapterHeading: boolean;
  categoryHeadingLevel: HeadingDepth;
  entryHeadingLevel: HeadingDepth;
  subsectionHeadingLevel: HeadingDepth;
  featureHeadingLevel: HeadingDepth;
  abilityScoreFormat: 'table-6col' | 'inline-compact';
  includeSourceCitations: boolean;
  includeDiceAverages: boolean;
  readAloudBorderStyle: 'shaded-box' | 'indented-quote';
  pageBreakBetweenEntries: boolean;
  fontFamily: 'Cambria' | 'Georgia' | 'Calibri';
}

export interface SourceCatalogItem {
  label: string;
  path: string;
  category: CategoryType;
}
