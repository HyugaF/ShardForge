import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  CategoryType,
  DocBlock,
  HeadingDepth,
  NormalizedEntry,
  ShardFormattingConfig,
  TextSpan,
} from '../types/converter';
import { formatModifier } from './tagParser';

const HEADING_LEVEL_MAP: Record<HeadingDepth, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
};

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

function spansToTextRuns(spans: TextSpan[], font: string, sizeHalfPt = 22): TextRun[] {
  return spans.map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italic,
        underline: s.underline ? {} : undefined,
        font,
        size: sizeHalfPt,
      })
  );
}

function buildAbilityTable(
  scores: { str: number; dex: number; con: number; int: number; wis: number; cha: number },
  font: string
): Table {
  const keys: (keyof typeof scores)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const headerCells = keys.map(
    (k) =>
      new TableCell({
        width: { size: 16.6, type: WidthType.PERCENTAGE },
        shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: k.toUpperCase(),
                bold: true,
                font,
                size: 20,
              }),
            ],
          }),
        ],
      })
  );

  const valueCells = keys.map((k) => {
    const val = scores[k];
    const mod = formatModifier(val);
    return new TableCell({
      width: { size: 16.6, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: `${val} (${mod})`,
              font,
              size: 20,
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), new TableRow({ children: valueCells })],
  });
}

function renderEntryBlocksToDocxNodes(
  entry: NormalizedEntry,
  config: ShardFormattingConfig,
  effectiveEntryHeading: HeadingDepth,
  effectiveSubHeading: HeadingDepth
): (Paragraph | Table)[] {
  const nodes: (Paragraph | Table)[] = [];
  const font = config.fontFamily;

  // Entry Heading (Maps to Section or Chapter in Shard Tabletop)
  nodes.push(
    new Paragraph({
      heading: HEADING_LEVEL_MAP[effectiveEntryHeading],
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: entry.name,
          bold: true,
          font,
        }),
      ],
    })
  );

  if (config.includeSourceCitations && entry.source) {
    nodes.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `Source: ${entry.source}${entry.page ? `, p. ${entry.page}` : ''}`,
            italics: true,
            color: '64748B',
            font,
            size: 18,
          }),
        ],
      })
    );
  }

  for (const block of entry.blocks) {
    switch (block.type) {
      case 'subtitle': {
        nodes.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: block.text,
                italics: true,
                font,
                size: 22,
              }),
            ],
          })
        );
        break;
      }

      case 'divider': {
        nodes.push(
          new Paragraph({
            border: {
              bottom: { color: '94A3B8', space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
            spacing: { before: 60, after: 100 },
            children: [],
          })
        );
        break;
      }

      case 'key-value': {
        nodes.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${block.label} `,
                bold: true,
                font,
                size: 22,
              }),
              new TextRun({
                text: block.value,
                font,
                size: 22,
              }),
            ],
          })
        );
        break;
      }

      case 'ability-array': {
        if (config.abilityScoreFormat === 'table-6col') {
          nodes.push(buildAbilityTable(block.scores, font));
          nodes.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        } else {
          const inlineParts = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(
            (k) => `${k.toUpperCase()} ${block.scores[k]} (${formatModifier(block.scores[k])})`
          );
          nodes.push(
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: inlineParts.join('   |   '),
                  bold: true,
                  font,
                  size: 21,
                }),
              ],
            })
          );
        }
        break;
      }

      case 'heading': {
        const levelToUse =
          block.shardRole === 'subsection' ? effectiveSubHeading : block.level;
        nodes.push(
          new Paragraph({
            heading: HEADING_LEVEL_MAP[levelToUse],
            spacing: { before: 180, after: 80 },
            children: [
              new TextRun({
                text: block.text,
                bold: true,
                font,
              }),
            ],
          })
        );
        break;
      }

      case 'feature-item': {
        nodes.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `${block.name}. `,
                bold: true,
                italics: true,
                font,
                size: 22,
              }),
              ...spansToTextRuns(block.spans, font, 22),
            ],
          })
        );
        break;
      }

      case 'paragraph': {
        nodes.push(
          new Paragraph({
            spacing: { after: 100 },
            children: spansToTextRuns(block.spans, font, 22),
          })
        );
        break;
      }

      case 'list': {
        for (const itemSpans of block.items) {
          nodes.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: spansToTextRuns(itemSpans, font, 22),
            })
          );
        }
        break;
      }

      case 'inset': {
        const borderSpec = {
          color: '64748B',
          space: 6,
          style: BorderStyle.SINGLE,
          size: 8,
        };
        const borders =
          config.readAloudBorderStyle === 'shaded-box'
            ? { top: borderSpec, bottom: borderSpec, left: borderSpec, right: borderSpec }
            : { left: borderSpec, right: borderSpec };

        if (block.title) {
          nodes.push(
            new Paragraph({
              indent: { left: 360, right: 360 },
              border: borders,
              shading:
                config.readAloudBorderStyle === 'shaded-box'
                  ? { fill: 'F8FAFC', type: ShadingType.CLEAR, color: 'auto' }
                  : undefined,
              spacing: { before: 100, after: 40 },
              children: [
                new TextRun({
                  text: block.title,
                  bold: true,
                  font,
                  size: 22,
                }),
              ],
            })
          );
        }

        for (const paraSpans of block.paragraphs) {
          nodes.push(
            new Paragraph({
              indent: { left: 360, right: 360 },
              border: borders,
              shading:
                config.readAloudBorderStyle === 'shaded-box'
                  ? { fill: 'F8FAFC', type: ShadingType.CLEAR, color: 'auto' }
                  : undefined,
              spacing: { before: 40, after: 80 },
              children: spansToTextRuns(paraSpans, font, 21),
            })
          );
        }
        break;
      }

      case 'table': {
        if (block.table.caption) {
          nodes.push(
            new Paragraph({
              spacing: { before: 120, after: 60 },
              children: [
                new TextRun({
                  text: block.table.caption,
                  bold: true,
                  italics: true,
                  font,
                  size: 21,
                }),
              ],
            })
          );
        }

        const tableRows: TableRow[] = [];
        if (block.table.headers.length > 0) {
          tableRows.push(
            new TableRow({
              children: block.table.headers.map(
                (h) =>
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [new TextRun({ text: h, bold: true, font, size: 20 })],
                      }),
                    ],
                  })
              ),
            })
          );
        }

        for (const r of block.table.rows) {
          tableRows.push(
            new TableRow({
              children: r.map(
                (cellText) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [new TextRun({ text: cellText, font, size: 20 })],
                      }),
                    ],
                  })
              ),
            })
          );
        }

        if (tableRows.length > 0) {
          nodes.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            })
          );
          nodes.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        }
        break;
      }
    }
  }

  return nodes;
}

/**
 * Compiles one or more NormalizedEntry records into a downloadable Shard Tabletop .docx file.
 */
export async function exportEntriesToShardDocx(
  entries: NormalizedEntry[],
  config: ShardFormattingConfig,
  filenameOverride?: string
): Promise<string> {
  if (entries.length === 0) {
    throw new Error('No entries selected for DOCX export.');
  }

  const children: (Paragraph | Table)[] = [];
  const isSingleInstant = entries.length === 1 && config.presetMode === 'single-convert';

  if (isSingleInstant) {
    const single = entries[0];
    children.push(...renderEntryBlocksToDocxNodes(single, config, 'H1', 'H2'));
  } else {
    // Group by category if includeCategoryChapterHeading is enabled
    if (config.includeCategoryChapterHeading) {
      const grouped = new Map<CategoryType, NormalizedEntry[]>();
      for (const e of entries) {
        const list = grouped.get(e.category) || [];
        list.push(e);
        grouped.set(e.category, list);
      }

      let catIndex = 0;
      for (const [cat, catEntries] of grouped.entries()) {
        if (catIndex > 0 && config.pageBreakBetweenEntries) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }

        children.push(
          new Paragraph({
            heading: HEADING_LEVEL_MAP[config.categoryHeadingLevel],
            spacing: { before: 320, after: 140 },
            children: [
              new TextRun({
                text: CATEGORY_PLURAL_TITLES[cat] || cat.toUpperCase(),
                bold: true,
                font: config.fontFamily,
              }),
            ],
          })
        );

        catEntries.forEach((entry, idx) => {
          if (idx > 0 && config.pageBreakBetweenEntries) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
          }
          children.push(
            ...renderEntryBlocksToDocxNodes(
              entry,
              config,
              config.entryHeadingLevel,
              config.subsectionHeadingLevel
            )
          );
        });

        catIndex++;
      }
    } else {
      entries.forEach((entry, idx) => {
        if (idx > 0 && config.pageBreakBetweenEntries) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }
        children.push(
          ...renderEntryBlocksToDocxNodes(
            entry,
            config,
            config.entryHeadingLevel,
            config.subsectionHeadingLevel
          )
        );
      });
    }
  }

  const doc = new Document({
    title: filenameOverride || config.bookTitle || 'Shard Tabletop Import Book',
    creator: 'ShardForge 5eTools Converter',
    description: 'Formatted 5eTools content structured for Shard Tabletop Import Book & Content Conversion',
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (filenameOverride || (entries.length === 1 ? entries[0].name : config.bookTitle) || 'shard-book')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const finalFilename = `${safeName || 'shard-import'}-shard.docx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return finalFilename;
}
