import {
  AbilityScores,
  CategoryType,
  DocBlock,
  HeadingDepth,
  NormalizedEntry,
  ShardFormattingConfig,
  TagTransformationSample,
  TextSpan,
} from '../types/converter';
import { parseSpansFromResolvedText, resolve5eToolsTags, TagParseOptions } from './tagParser';

const SIZE_MAP: Record<string, string> = {
  T: 'Tiny',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  H: 'Huge',
  G: 'Gargantuan',
};

const ALIGN_MAP: Record<string, string> = {
  L: 'lawful',
  N: 'neutral',
  NX: 'neutral',
  NY: 'neutral',
  C: 'chaotic',
  G: 'good',
  E: 'evil',
  U: 'unaligned',
  A: 'any alignment',
};

const SCHOOL_MAP: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
};

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

function ordinalSpellLevel(level: number, school: string): string {
  const schoolName = SCHOOL_MAP[school] || school || 'Arcane';
  if (level === 0) return `${schoolName} cantrip`;
  const suffix = level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th';
  return `${level}${suffix}-level ${schoolName.toLowerCase()}`;
}

function nextHeadingDepth(depth: HeadingDepth): HeadingDepth {
  const order: HeadingDepth[] = ['H1', 'H2', 'H3', 'H4', 'H5'];
  const idx = order.indexOf(depth);
  return order[Math.min(idx + 1, order.length - 1)];
}

/**
 * Recursively converts 5eTools `entries` arrays (strings, sections, lists, tables, insets, quotes, abilityDc)
 * into Normalized `DocBlock[]`.
 */
export function parseEntriesRecursive(
  entries: unknown[],
  currentHeading: HeadingDepth,
  tagOpts: TagParseOptions,
  auditLog: TagTransformationSample[]
): DocBlock[] {
  const blocks: DocBlock[] = [];
  if (!Array.isArray(entries)) return blocks;

  for (const entry of entries) {
    if (typeof entry === 'string') {
      blocks.push({
        type: 'paragraph',
        spans: parseSpansFromResolvedText(entry, tagOpts, auditLog),
      });
      continue;
    }

    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, any>;
    const type = obj.type || 'entries';

    if (type === 'entries' || type === 'section') {
      if (obj.name) {
        // If it's a compact inline feature entry (e.g. a single string child inside a monster trait or feat),
        // render as a bold-italic feature-item OR a subsection heading depending on structure
        if (
          type === 'entries' &&
          Array.isArray(obj.entries) &&
          obj.entries.length > 0 &&
          typeof obj.entries[0] === 'string' &&
          currentHeading !== 'H1' &&
          currentHeading !== 'H2'
        ) {
          const firstSpans = parseSpansFromResolvedText(obj.entries[0], tagOpts, auditLog);
          blocks.push({
            type: 'feature-item',
            name: resolve5eToolsTags(String(obj.name), tagOpts, auditLog),
            spans: firstSpans,
          });
          if (obj.entries.length > 1) {
            blocks.push(
              ...parseEntriesRecursive(obj.entries.slice(1), nextHeadingDepth(currentHeading), tagOpts, auditLog)
            );
          }
          continue;
        }

        blocks.push({
          type: 'heading',
          level: currentHeading,
          text: resolve5eToolsTags(String(obj.name), tagOpts, auditLog),
          shardRole: 'subsection',
        });
      }

      if (Array.isArray(obj.entries)) {
        blocks.push(
          ...parseEntriesRecursive(
            obj.entries,
            obj.name ? nextHeadingDepth(currentHeading) : currentHeading,
            tagOpts,
            auditLog
          )
        );
      }
    } else if (type === 'list') {
      const listItems: TextSpan[][] = [];
      if (Array.isArray(obj.items)) {
        for (const item of obj.items) {
          if (typeof item === 'string') {
            listItems.push(parseSpansFromResolvedText(item, tagOpts, auditLog));
          } else if (item && typeof item === 'object') {
            const itemObj = item as Record<string, any>;
            const namePrefix = itemObj.name ? `***${itemObj.name}.*** ` : '';
            const bodyStr =
              typeof itemObj.entry === 'string'
                ? itemObj.entry
                : Array.isArray(itemObj.entries)
                  ? itemObj.entries.filter((e: unknown) => typeof e === 'string').join(' ')
                  : '';
            listItems.push(parseSpansFromResolvedText(`${namePrefix}${bodyStr}`, tagOpts, auditLog));
          }
        }
      }
      if (listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems });
      }
    } else if (type === 'table') {
      const headers = Array.isArray(obj.colLabels)
        ? obj.colLabels.map((h: unknown) => resolve5eToolsTags(String(h || ''), tagOpts, auditLog))
        : [];
      const rows: string[][] = [];
      if (Array.isArray(obj.rows)) {
        for (const row of obj.rows) {
          if (Array.isArray(row)) {
            rows.push(
              row.map((cell: unknown) => {
                if (typeof cell === 'string' || typeof cell === 'number') {
                  return resolve5eToolsTags(String(cell), tagOpts, auditLog);
                }
                if (cell && typeof cell === 'object' && 'roll' in (cell as any)) {
                  const r = (cell as any).roll;
                  if (r.exact !== undefined) return String(r.exact);
                  if (r.min !== undefined && r.max !== undefined) return `${r.min}–${r.max}`;
                }
                return '';
              })
            );
          }
        }
      }
      blocks.push({
        type: 'table',
        table: {
          caption: obj.caption ? resolve5eToolsTags(String(obj.caption), tagOpts, auditLog) : undefined,
          headers,
          rows,
        },
      });
    } else if (type === 'inset' || type === 'insetReadaloud' || type === 'quote') {
      const paragraphs: TextSpan[][] = [];
      if (Array.isArray(obj.entries)) {
        for (const sub of obj.entries) {
          if (typeof sub === 'string') {
            paragraphs.push(parseSpansFromResolvedText(sub, tagOpts, auditLog));
          }
        }
      }
      if (obj.by) {
        paragraphs.push([{ text: `— ${resolve5eToolsTags(String(obj.by), tagOpts, auditLog)}`, italic: true }]);
      }
      if (paragraphs.length > 0) {
        blocks.push({
          type: 'inset',
          title: obj.name ? resolve5eToolsTags(String(obj.name), tagOpts, auditLog) : undefined,
          readAloud: type === 'insetReadaloud' || type === 'quote',
          paragraphs,
        });
      }
    } else if (type === 'abilityDc' && Array.isArray(obj.attributes)) {
      const attrNames = obj.attributes.map((a: string) => ABILITY_LABELS[a] || a.toUpperCase()).join(' or ');
      blocks.push({
        type: 'key-value',
        label: 'Spell Save DC',
        value: `8 + your proficiency bonus + your ${attrNames} modifier`,
      });
    } else if (type === 'abilityAttackMod' && Array.isArray(obj.attributes)) {
      const attrNames = obj.attributes.map((a: string) => ABILITY_LABELS[a] || a.toUpperCase()).join(' or ');
      blocks.push({
        type: 'key-value',
        label: 'Spell Attack Modifier',
        value: `your proficiency bonus + your ${attrNames} modifier`,
      });
    } else if (Array.isArray(obj.entries)) {
      blocks.push(...parseEntriesRecursive(obj.entries, currentHeading, tagOpts, auditLog));
    }
  }

  return blocks;
}

function parseMonsterToNormalized(
  m: Record<string, any>,
  config: ShardFormattingConfig,
  originType: NormalizedEntry['originType']
): NormalizedEntry {
  const auditLog: TagTransformationSample[] = [];
  const tagOpts: TagParseOptions = { includeDiceAverages: config.includeDiceAverages };
  const blocks: DocBlock[] = [];

  const name = String(m.name || 'Unnamed Monster');
  const source = String(m.source || 'Homebrew');

  const sizeArr = Array.isArray(m.size) ? m.size : [m.size || 'M'];
  const sizeStr = sizeArr.map((s: string) => SIZE_MAP[s] || s).join(' or ');

  let typeStr = 'creature';
  if (typeof m.type === 'string') {
    typeStr = m.type;
  } else if (m.type && typeof m.type === 'object') {
    const baseType = m.type.type || 'creature';
    const tags = Array.isArray(m.type.tags)
      ? m.type.tags.map((t: any) => (typeof t === 'string' ? t : t.tag)).join(', ')
      : '';
    typeStr = tags ? `${baseType} (${tags})` : baseType;
  }

  let alignStr = 'unaligned';
  if (Array.isArray(m.alignment)) {
    alignStr = m.alignment
      .map((a: any) => (typeof a === 'string' ? ALIGN_MAP[a] || a : 'unaligned'))
      .join(' ');
    if (alignStr === 'neutral neutral') alignStr = 'neutral';
  }

  const subtitle = `${sizeStr} ${typeStr}, ${alignStr}`;
  blocks.push({ type: 'subtitle', text: subtitle });

  // Armor Class
  let acStr = '10';
  if (Array.isArray(m.ac)) {
    acStr = m.ac
      .map((acItem: any) => {
        if (typeof acItem === 'number' || typeof acItem === 'string') return String(acItem);
        if (acItem && typeof acItem === 'object') {
          const val = acItem.ac ?? 10;
          const from = Array.isArray(acItem.from)
            ? ` (${resolve5eToolsTags(acItem.from.join(', '), tagOpts, auditLog)})`
            : acItem.condition
              ? ` ${resolve5eToolsTags(acItem.condition, tagOpts, auditLog)}`
              : '';
          return `${val}${from}`;
        }
        return '10';
      })
      .join(', ');
  }
  blocks.push({ type: 'key-value', label: 'Armor Class', value: acStr });

  // Hit Points
  let hpStr = '10 (2d8 + 2)';
  if (m.hp && typeof m.hp === 'object') {
    if (m.hp.special) {
      hpStr = resolve5eToolsTags(String(m.hp.special), tagOpts, auditLog);
    } else {
      const avg = m.hp.average ?? 10;
      const formula = m.hp.formula ? ` (${m.hp.formula})` : '';
      hpStr = config.includeDiceAverages ? `${avg}${formula}` : m.hp.formula || String(avg);
    }
  }
  blocks.push({ type: 'key-value', label: 'Hit Points', value: hpStr });

  // Speed
  let speedStr = '30 ft.';
  if (m.speed && typeof m.speed === 'object') {
    const parts: string[] = [];
    if (m.speed.walk !== undefined) {
      parts.push(typeof m.speed.walk === 'object' ? `${m.speed.walk.number} ft.` : `${m.speed.walk} ft.`);
    }
    for (const mode of ['burrow', 'climb', 'fly', 'swim']) {
      if (m.speed[mode] !== undefined) {
        const val = m.speed[mode];
        const hover = mode === 'fly' && m.speed.canHover ? ' (hover)' : '';
        parts.push(
          typeof val === 'object'
            ? `${mode} ${val.number} ft.${val.condition || hover}`
            : `${mode} ${val} ft.${hover}`
        );
      }
    }
    if (parts.length > 0) speedStr = parts.join(', ');
  }
  blocks.push({ type: 'key-value', label: 'Speed', value: speedStr });

  // Ability Scores
  const scores: AbilityScores = {
    str: Number(m.str ?? 10),
    dex: Number(m.dex ?? 10),
    con: Number(m.con ?? 10),
    int: Number(m.int ?? 10),
    wis: Number(m.wis ?? 10),
    cha: Number(m.cha ?? 10),
  };
  blocks.push({ type: 'ability-array', scores });

  // Saving Throws
  if (m.save && typeof m.save === 'object') {
    const saves = Object.entries(m.save)
      .map(([k, v]) => `${ABILITY_LABELS[k] || k.toUpperCase()} ${v}`)
      .join(', ');
    if (saves) blocks.push({ type: 'key-value', label: 'Saving Throws', value: saves });
  }

  // Skills
  if (m.skill && typeof m.skill === 'object') {
    const skills = Object.entries(m.skill)
      .filter(([k]) => k !== 'other')
      .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`)
      .join(', ');
    if (skills) blocks.push({ type: 'key-value', label: 'Skills', value: skills });
  }

  // Resistances / Immunities / Vulnerabilities
  const formatDamageArray = (arr: any[]): string =>
    arr
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const sub = Array.isArray(item.resist || item.immune || item.vulnerable)
            ? (item.resist || item.immune || item.vulnerable).join(', ')
            : '';
          const note = item.note ? ` ${item.note}` : '';
          return `${sub}${note}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('; ');

  if (Array.isArray(m.vulnerable) && m.vulnerable.length > 0) {
    blocks.push({ type: 'key-value', label: 'Damage Vulnerabilities', value: formatDamageArray(m.vulnerable) });
  }
  if (Array.isArray(m.resist) && m.resist.length > 0) {
    blocks.push({ type: 'key-value', label: 'Damage Resistances', value: formatDamageArray(m.resist) });
  }
  if (Array.isArray(m.immune) && m.immune.length > 0) {
    blocks.push({ type: 'key-value', label: 'Damage Immunities', value: formatDamageArray(m.immune) });
  }
  if (Array.isArray(m.conditionImmune) && m.conditionImmune.length > 0) {
    const conds = m.conditionImmune
      .map((c: any) => (typeof c === 'string' ? c : c.conditionImmune?.join(', ') || ''))
      .filter(Boolean)
      .join(', ');
    if (conds) blocks.push({ type: 'key-value', label: 'Condition Immunities', value: conds });
  }

  // Senses
  const sensesList: string[] = Array.isArray(m.senses) ? [...m.senses] : [];
  sensesList.push(`passive Perception ${m.passive ?? 10}`);
  blocks.push({
    type: 'key-value',
    label: 'Senses',
    value: resolve5eToolsTags(sensesList.join(', '), tagOpts, auditLog),
  });

  // Languages
  const langs = Array.isArray(m.languages) && m.languages.length > 0 ? m.languages.join(', ') : '—';
  blocks.push({ type: 'key-value', label: 'Languages', value: resolve5eToolsTags(langs, tagOpts, auditLog) });

  // Challenge
  const crVal = typeof m.cr === 'object' ? m.cr?.cr || '0' : String(m.cr ?? '0');
  blocks.push({ type: 'key-value', label: 'Challenge', value: crVal });

  blocks.push({ type: 'divider' });

  // Traits
  if (Array.isArray(m.trait)) {
    for (const t of m.trait) {
      const traitName = resolve5eToolsTags(String(t.name || 'Trait'), tagOpts, auditLog);
      const entries = Array.isArray(t.entries) ? t.entries : [];
      const firstStr = typeof entries[0] === 'string' ? entries[0] : '';
      blocks.push({
        type: 'feature-item',
        name: traitName,
        spans: parseSpansFromResolvedText(firstStr, tagOpts, auditLog),
      });
      if (entries.length > 1) {
        blocks.push(...parseEntriesRecursive(entries.slice(1), config.subsectionHeadingLevel, tagOpts, auditLog));
      }
    }
  }

  // Spellcasting
  if (Array.isArray(m.spellcasting)) {
    for (const sc of m.spellcasting) {
      const scName = resolve5eToolsTags(String(sc.name || 'Spellcasting'), tagOpts, auditLog);
      const headerEntries = Array.isArray(sc.headerEntries) ? sc.headerEntries.join(' ') : '';
      blocks.push({
        type: 'feature-item',
        name: scName,
        spans: parseSpansFromResolvedText(headerEntries, tagOpts, auditLog),
      });
      const spellLines: TextSpan[][] = [];
      if (sc.will && Array.isArray(sc.will)) {
        spellLines.push(
          parseSpansFromResolvedText(`**At will:** ${sc.will.join(', ')}`, tagOpts, auditLog)
        );
      }
      if (sc.daily && typeof sc.daily === 'object') {
        for (const [freq, list] of Object.entries(sc.daily)) {
          if (Array.isArray(list)) {
            const perDay = freq.replace('e', '/day each').replace(/^(\d+)$/, '$1/day');
            spellLines.push(
              parseSpansFromResolvedText(`**${perDay}:** ${list.join(', ')}`, tagOpts, auditLog)
            );
          }
        }
      }
      if (sc.spells && typeof sc.spells === 'object') {
        for (const [lvl, spellObj] of Object.entries(sc.spells as Record<string, any>)) {
          if (spellObj && Array.isArray(spellObj.spells)) {
            const label =
              lvl === '0'
                ? 'Cantrips (at will)'
                : `${lvl}${lvl === '1' ? 'st' : lvl === '2' ? 'nd' : lvl === '3' ? 'rd' : 'th'} level (${spellObj.slots ?? 1} slots)`;
            spellLines.push(
              parseSpansFromResolvedText(`**${label}:** ${spellObj.spells.join(', ')}`, tagOpts, auditLog)
            );
          }
        }
      }
      if (spellLines.length > 0) {
        blocks.push({ type: 'list', items: spellLines });
      }
    }
  }

  // Action Subsections (Crucial for Shard Tabletop's Monster Converter!)
  const actionSections: { key: string; title: string; preamble?: string }[] = [
    { key: 'action', title: 'Actions' },
    { key: 'bonus', title: 'Bonus Actions' },
    { key: 'reaction', title: 'Reactions' },
    {
      key: 'legendary',
      title: 'Legendary Actions',
      preamble:
        m.legendaryHeader && Array.isArray(m.legendaryHeader)
          ? m.legendaryHeader.join(' ')
          : `The ${name.toLowerCase()} can take ${m.legendaryActions ?? 3} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${name.toLowerCase()} regains spent legendary actions at the start of its turn.`,
    },
    { key: 'mythic', title: 'Mythic Actions' },
  ];

  for (const sec of actionSections) {
    const arr = m[sec.key];
    if (Array.isArray(arr) && arr.length > 0) {
      blocks.push({
        type: 'heading',
        level: config.subsectionHeadingLevel,
        text: sec.title,
        shardRole: 'subsection',
      });
      if (sec.preamble) {
        blocks.push({
          type: 'paragraph',
          spans: parseSpansFromResolvedText(sec.preamble, tagOpts, auditLog),
        });
      }
      for (const act of arr) {
        const actName = resolve5eToolsTags(String(act.name || 'Action'), tagOpts, auditLog);
        const entries = Array.isArray(act.entries) ? act.entries : [];
        const firstStr = typeof entries[0] === 'string' ? entries[0] : '';
        blocks.push({
          type: 'feature-item',
          name: actName,
          spans: parseSpansFromResolvedText(firstStr, tagOpts, auditLog),
        });
        if (entries.length > 1) {
          blocks.push(
            ...parseEntriesRecursive(entries.slice(1), nextHeadingDepth(config.subsectionHeadingLevel), tagOpts, auditLog)
          );
        }
      }
    }
  }

  return {
    id: `monster-${name}-${source}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name,
    category: 'monster',
    source,
    page: m.page,
    summaryMeta: `${sizeStr} ${typeStr} · CR ${crVal} · ${source}`,
    badgeCode: `CR ${crVal}`,
    blocks,
    rawSourceSnippet: JSON.stringify(m, null, 2),
    tagTransformations: auditLog,
    originType,
  };
}

function parseSpellToNormalized(
  s: Record<string, any>,
  config: ShardFormattingConfig,
  originType: NormalizedEntry['originType']
): NormalizedEntry {
  const auditLog: TagTransformationSample[] = [];
  const tagOpts: TagParseOptions = { includeDiceAverages: config.includeDiceAverages };
  const blocks: DocBlock[] = [];

  const name = String(s.name || 'Unnamed Spell');
  const source = String(s.source || 'PHB');
  const level = Number(s.level ?? 0);
  const school = String(s.school || 'V');
  const isRitual = Boolean(s.meta?.ritual);

  const subtitle = `${ordinalSpellLevel(level, school)}${isRitual ? ' (ritual)' : ''}`;
  blocks.push({ type: 'subtitle', text: subtitle });

  // Casting Time
  let timeStr = '1 action';
  if (Array.isArray(s.time) && s.time[0]) {
    const t = s.time[0];
    timeStr = `${t.number ?? 1} ${t.unit ?? 'action'}${t.condition ? ` (${resolve5eToolsTags(t.condition, tagOpts, auditLog)})` : ''}`;
  }
  blocks.push({ type: 'key-value', label: 'Casting Time', value: timeStr });

  // Range
  let rangeStr = 'Self';
  if (s.range && typeof s.range === 'object') {
    if (s.range.type === 'point' && s.range.distance) {
      const d = s.range.distance;
      rangeStr = d.amount ? `${d.amount} ${d.type}` : String(d.type || 'Self');
    } else if (s.range.distance) {
      const d = s.range.distance;
      rangeStr = `Self (${d.amount ?? ''}-${d.type ?? ''} ${s.range.type})`.trim();
    }
  }
  blocks.push({ type: 'key-value', label: 'Range', value: rangeStr });

  // Components
  const compParts: string[] = [];
  if (s.components) {
    if (s.components.v) compParts.push('V');
    if (s.components.s) compParts.push('S');
    if (s.components.m) {
      const mText = typeof s.components.m === 'string' ? s.components.m : s.components.m.text || '';
      compParts.push(mText ? `M (${resolve5eToolsTags(mText, tagOpts, auditLog)})` : 'M');
    }
  }
  blocks.push({ type: 'key-value', label: 'Components', value: compParts.join(', ') || 'V, S' });

  // Duration
  let durStr = 'Instantaneous';
  if (Array.isArray(s.duration) && s.duration[0]) {
    const d = s.duration[0];
    if (d.type === 'instant') {
      durStr = 'Instantaneous';
    } else if (d.type === 'timed' && d.duration) {
      const prefix = d.concentration ? 'Concentration, up to ' : '';
      durStr = `${prefix}${d.duration.amount ?? 1} ${d.duration.type ?? 'minute'}${d.duration.amount > 1 ? 's' : ''}`;
    } else if (d.type === 'permanent') {
      durStr = 'Until dispelled';
    } else if (d.type === 'special') {
      durStr = 'Special';
    }
  }
  blocks.push({ type: 'key-value', label: 'Duration', value: durStr });

  blocks.push({ type: 'divider' });

  if (Array.isArray(s.entries)) {
    blocks.push(...parseEntriesRecursive(s.entries, config.subsectionHeadingLevel, tagOpts, auditLog));
  }

  if (Array.isArray(s.entriesHigherLevel)) {
    for (const hl of s.entriesHigherLevel) {
      const hlName = resolve5eToolsTags(String(hl.name || 'At Higher Levels'), tagOpts, auditLog);
      const hlText = Array.isArray(hl.entries) ? hl.entries.join(' ') : '';
      blocks.push({
        type: 'feature-item',
        name: hlName,
        spans: parseSpansFromResolvedText(hlText, tagOpts, auditLog),
      });
    }
  }

  return {
    id: `spell-${name}-${source}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name,
    category: 'spell',
    source,
    page: s.page,
    summaryMeta: `${ordinalSpellLevel(level, school)} · ${source}`,
    badgeCode: level === 0 ? 'Cantrip' : `Lvl ${level}`,
    blocks,
    rawSourceSnippet: JSON.stringify(s, null, 2),
    tagTransformations: auditLog,
    originType,
  };
}

function parseItemToNormalized(
  item: Record<string, any>,
  config: ShardFormattingConfig,
  originType: NormalizedEntry['originType']
): NormalizedEntry {
  const auditLog: TagTransformationSample[] = [];
  const tagOpts: TagParseOptions = { includeDiceAverages: config.includeDiceAverages };
  const blocks: DocBlock[] = [];

  const name = String(item._displayName || item.name || 'Unnamed Item');
  const source = String(item.source || 'DMG');
  const rarity = item.rarity && item.rarity !== 'none' ? String(item.rarity) : 'mundane';
  const reqAttune =
    typeof item.reqAttune === 'string'
      ? `requires attunement ${item.reqAttune}`
      : item.reqAttune
        ? 'requires attunement'
        : '';
  const itemType =
    Array.isArray(item._typeListText) && item._typeListText.length > 0
      ? item._typeListText.join(', ')
      : item.wondrous
        ? 'Wondrous item'
        : item.weaponCategory
          ? `${item.weaponCategory} weapon`
          : item.type || 'Adventuring gear';

  const subtitle = [itemType, rarity, reqAttune ? `(${reqAttune})` : ''].filter(Boolean).join(', ');
  blocks.push({ type: 'subtitle', text: subtitle });

  if (item.ac) {
    blocks.push({ type: 'key-value', label: 'Armor Class', value: String(item.ac) });
  }
  if (item.dmg1) {
    blocks.push({
      type: 'key-value',
      label: 'Damage',
      value: `${item.dmg1} ${item.dmgType || ''}${item.dmg2 ? ` (versatile ${item.dmg2})` : ''}`.trim(),
    });
  }
  if (item.weight) {
    blocks.push({ type: 'key-value', label: 'Weight', value: `${item.weight} lb.` });
  }
  if (item.value) {
    blocks.push({ type: 'key-value', label: 'Value', value: `${item.value / 100} gp` });
  }

  blocks.push({ type: 'divider' });

  const entriesToParse =
    Array.isArray(item._fullEntries) && item._fullEntries.length > 0
      ? item._fullEntries
      : Array.isArray(item.entries)
        ? item.entries
        : [];

  if (entriesToParse.length > 0) {
    blocks.push(...parseEntriesRecursive(entriesToParse, config.subsectionHeadingLevel, tagOpts, auditLog));
  }

  return {
    id: `item-${name}-${source}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name,
    category: 'item',
    source,
    page: item.page,
    summaryMeta: `${itemType} · ${rarity} · ${source}`,
    badgeCode: rarity.charAt(0).toUpperCase() + rarity.slice(1),
    blocks,
    rawSourceSnippet: JSON.stringify(item, null, 2),
    tagTransformations: auditLog,
    originType,
  };
}

function parseGenericEntryToNormalized(
  raw: Record<string, any>,
  category: CategoryType,
  config: ShardFormattingConfig,
  originType: NormalizedEntry['originType'],
  linkedFeatures?: Record<string, any>[],
  activeSubclasses?: Record<string, any>[]
): NormalizedEntry {
  const auditLog: TagTransformationSample[] = [];
  const tagOpts: TagParseOptions = { includeDiceAverages: config.includeDiceAverages };
  const blocks: DocBlock[] = [];

  const name = String(raw._displayName || raw.name || `Unnamed ${category}`);
  const source = String(raw.source || 'PHB');

  let badgeCode = category.charAt(0).toUpperCase() + category.slice(1);
  let metaDetail = category.toUpperCase();

  if (category === 'feat') {
    badgeCode = 'Feat';
    if (Array.isArray(raw.prerequisite) && raw.prerequisite.length > 0) {
      const prereqParts: string[] = [];
      const p = raw.prerequisite[0];
      if (p.level) prereqParts.push(`Level ${typeof p.level === 'object' ? p.level.level : p.level}`);
      if (p.spellcasting) prereqParts.push('Spellcasting feature');
      if (p.race && Array.isArray(p.race)) prereqParts.push(p.race.map((r: any) => r.name).join(' or '));
      const prereqStr = prereqParts.join(', ') || 'Special';
      blocks.push({ type: 'subtitle', text: `Prerequisite: ${prereqStr}` });
      metaDetail = `Prerequisite: ${prereqStr}`;
    } else {
      blocks.push({ type: 'subtitle', text: 'General Feat' });
    }
  } else if (category === 'race') {
    badgeCode = 'Race';
    const size = Array.isArray(raw.size) ? raw.size.map((s: string) => SIZE_MAP[s] || s).join('/') : 'Medium';
    const speed = typeof raw.speed === 'number' ? `${raw.speed} ft.` : raw.speed?.walk ? `${raw.speed.walk} ft.` : '30 ft.';
    blocks.push({ type: 'subtitle', text: `${size} Humanoid · Speed ${speed}` });
    metaDetail = `${size} · Speed ${speed}`;
  } else if (category === 'background') {
    badgeCode = 'Background';
    blocks.push({ type: 'subtitle', text: 'Character Background' });
  } else if (category === 'class' || category === 'subclass') {
    badgeCode = category === 'class' ? 'Class' : 'Subclass';
    if (raw.hd && raw.hd.faces) {
      blocks.push({ type: 'key-value', label: 'Hit Dice', value: `1d${raw.hd.faces} per ${name} level` });
      blocks.push({
        type: 'key-value',
        label: 'Hit Points at 1st Level',
        value: `${raw.hd.faces} + your Constitution modifier`,
      });
      blocks.push({
        type: 'key-value',
        label: 'Hit Points at Higher Levels',
        value: `1d${raw.hd.faces} (or ${Math.floor(raw.hd.faces / 2) + 1}) + your Constitution modifier per ${name} level after 1st`,
      });
      metaDetail = `d${raw.hd.faces} Hit Die`;
    }
    if (Array.isArray(raw.proficiency)) {
      blocks.push({
        type: 'key-value',
        label: 'Saving Throw Proficiencies',
        value: raw.proficiency.map((p: string) => ABILITY_LABELS[p] || p.toUpperCase()).join(', '),
      });
    }
    if (raw.startingProficiencies && typeof raw.startingProficiencies === 'object') {
      const sp = raw.startingProficiencies;
      if (Array.isArray(sp.armor)) {
        blocks.push({
          type: 'key-value',
          label: 'Armor Proficiencies',
          value: resolve5eToolsTags(
            sp.armor.map((a: any) => (typeof a === 'string' ? a : a.proficiency || '')).filter(Boolean).join(', '),
            tagOpts,
            auditLog
          ),
        });
      }
      if (Array.isArray(sp.weapons)) {
        blocks.push({
          type: 'key-value',
          label: 'Weapon Proficiencies',
          value: resolve5eToolsTags(
            sp.weapons.map((w: any) => (typeof w === 'string' ? w : w.proficiency || '')).filter(Boolean).join(', '),
            tagOpts,
            auditLog
          ),
        });
      }
    }
    if (raw.casterProgression) {
      blocks.push({ type: 'key-value', label: 'Spellcasting Progression', value: `${raw.casterProgression} caster` });
    }
    if (raw.startingEquipment && Array.isArray(raw.startingEquipment.default)) {
      blocks.push({
        type: 'heading',
        level: config.subsectionHeadingLevel,
        text: 'Starting Equipment',
        shardRole: 'subsection',
      });
      blocks.push({
        type: 'list',
        items: raw.startingEquipment.default.map((line: string) =>
          parseSpansFromResolvedText(line, tagOpts, auditLog)
        ),
      });
    }
  } else if (category === 'adventure') {
    badgeCode = 'Chapter';
    metaDetail = 'Adventure / Book Section';
  }

  blocks.push({ type: 'divider' });

  if (Array.isArray(raw.entries)) {
    blocks.push(...parseEntriesRecursive(raw.entries, config.subsectionHeadingLevel, tagOpts, auditLog));
  }

  // Extract dereferenced 2D classFeatures from live 5eTools ClassesPage (`raw.classFeatures` = [[feat, ...], ...])
  const effectiveClassFeatures: Record<string, any>[] = [...(linkedFeatures || [])];
  if (effectiveClassFeatures.length === 0 && Array.isArray(raw.classFeatures)) {
    for (const levelItem of raw.classFeatures) {
      if (Array.isArray(levelItem)) {
        for (const featObj of levelItem) {
          if (featObj && typeof featObj === 'object' && featObj.name) {
            effectiveClassFeatures.push(featObj);
          }
        }
      } else if (levelItem && typeof levelItem === 'object' && levelItem.name) {
        effectiveClassFeatures.push(levelItem);
      }
    }
  }

  if (effectiveClassFeatures.length > 0) {
    const sorted = [...effectiveClassFeatures].sort((a, b) => Number(a.level ?? 1) - Number(b.level ?? 1));
    for (const feat of sorted) {
      const fName = resolve5eToolsTags(String(feat.name || 'Class Feature'), tagOpts, auditLog);
      const fLvl = feat.level ? ` (Level ${feat.level})` : '';
      blocks.push({
        type: 'heading',
        level: config.subsectionHeadingLevel,
        text: `${fName}${fLvl}`,
        shardRole: 'feature-level',
      });
      if (Array.isArray(feat.entries)) {
        blocks.push(...parseEntriesRecursive(feat.entries, config.featureHeadingLevel, tagOpts, auditLog));
      }
    }
  }

  // Append any active subclasses toggled on in 5eTools classes.html
  if (activeSubclasses && activeSubclasses.length > 0) {
    for (const sc of activeSubclasses) {
      const scName = resolve5eToolsTags(String(sc.name || sc.shortName || 'Subclass'), tagOpts, auditLog);
      blocks.push({
        type: 'heading',
        level: config.subsectionHeadingLevel,
        text: `Subclass: ${scName} (${sc.source || source})`,
        shardRole: 'subsection',
      });
      if (Array.isArray(sc.subclassFeatures)) {
        for (const scLevelGroup of sc.subclassFeatures) {
          const groupArr = Array.isArray(scLevelGroup) ? scLevelGroup : [scLevelGroup];
          for (const scFeat of groupArr) {
            if (scFeat && typeof scFeat === 'object' && Array.isArray(scFeat.entries)) {
              blocks.push(
                ...parseEntriesRecursive(scFeat.entries, config.featureHeadingLevel, tagOpts, auditLog)
              );
            }
          }
        }
      }
    }
  }

  return {
    id: `${category}-${name}-${source}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name,
    category,
    source,
    page: raw.page,
    summaryMeta: `${metaDetail} · ${source}`,
    badgeCode,
    blocks,
    rawSourceSnippet: JSON.stringify(raw, null, 2),
    tagTransformations: auditLog,
    originType,
  };
}

/**
 * Parses a full 5eTools JSON object or array into NormalizedEntry[]
 */
export function parse5eToolsJsonPayload(
  payload: unknown,
  config: ShardFormattingConfig,
  originType: NormalizedEntry['originType'] = '5etools-repo'
): NormalizedEntry[] {
  if (!payload || typeof payload !== 'object') return [];
  const results: NormalizedEntry[] = [];

  if (Array.isArray(payload)) {
    for (const item of payload) {
      results.push(...parse5eToolsJsonPayload(item, config, originType));
    }
    return results;
  }

  const root = payload as Record<string, any>;

  // 1. Bestiary Monsters
  if (Array.isArray(root.monster)) {
    for (const m of root.monster) {
      if (m && typeof m === 'object' && m.name && !m._copy) {
        results.push(parseMonsterToNormalized(m, config, originType));
      }
    }
  }

  // 2. Spells
  if (Array.isArray(root.spell)) {
    for (const s of root.spell) {
      if (s && typeof s === 'object' && s.name) {
        results.push(parseSpellToNormalized(s, config, originType));
      }
    }
  }

  // 3. Items & Base Items
  const itemArrays = [root.item, root.baseitem, root.itemGroup].filter(Array.isArray);
  for (const arr of itemArrays) {
    for (const it of arr) {
      if (it && typeof it === 'object' && it.name && !it._copy) {
        results.push(parseItemToNormalized(it, config, originType));
      }
    }
  }

  // 4. Feats
  if (Array.isArray(root.feat)) {
    for (const f of root.feat) {
      if (f && typeof f === 'object' && f.name) {
        results.push(parseGenericEntryToNormalized(f, 'feat', config, originType));
      }
    }
  }

  // 5. Races
  if (Array.isArray(root.race)) {
    for (const r of root.race) {
      if (r && typeof r === 'object' && r.name && !r._copy) {
        results.push(parseGenericEntryToNormalized(r, 'race', config, originType));
      }
    }
  }

  // 6. Backgrounds
  if (Array.isArray(root.background)) {
    for (const bg of root.background) {
      if (bg && typeof bg === 'object' && bg.name && !bg._copy) {
        results.push(parseGenericEntryToNormalized(bg, 'background', config, originType));
      }
    }
  }

  // 7. Classes & Subclasses with linked classFeature / subclassFeature arrays
  const classFeaturesArr: Record<string, any>[] = Array.isArray(root.classFeature) ? root.classFeature : [];
  const subclassFeaturesArr: Record<string, any>[] = Array.isArray(root.subclassFeature) ? root.subclassFeature : [];

  if (Array.isArray(root.class)) {
    for (const cls of root.class) {
      if (cls && typeof cls === 'object' && cls.name) {
        const matchingFeatures = classFeaturesArr.filter(
          (cf) => cf.className === cls.name && (!cf.classSource || cf.classSource === cls.source)
        );
        results.push(parseGenericEntryToNormalized(cls, 'class', config, originType, matchingFeatures));
      }
    }
  }

  if (Array.isArray(root.subclass)) {
    for (const sc of root.subclass) {
      if (sc && typeof sc === 'object' && sc.name) {
        const matchingSubFeatures = subclassFeaturesArr.filter(
          (scf) => scf.subclassShortName === sc.shortName && scf.className === sc.className
        );
        results.push(parseGenericEntryToNormalized(sc, 'subclass', config, originType, matchingSubFeatures));
      }
    }
  }

  // 8. Adventure / Book sections (`data` array)
  if (Array.isArray(root.data)) {
    for (const section of root.data) {
      if (section && typeof section === 'object' && section.name) {
        results.push(parseGenericEntryToNormalized(section, 'adventure', config, originType));
      }
    }
  }

  // 9. Single standalone object (e.g. user pasted a single monster, spell, or item JSON directly)
  if (results.length === 0 && root.name) {
    if (root.str !== undefined && root.dex !== undefined && (root.ac !== undefined || root.hp !== undefined)) {
      results.push(parseMonsterToNormalized(root, config, originType));
    } else if (root.level !== undefined && root.school !== undefined) {
      results.push(parseSpellToNormalized(root, config, originType));
    } else if (
      root.rarity !== undefined ||
      root.wondrous !== undefined ||
      root.weaponCategory !== undefined ||
      Array.isArray(root._fullEntries)
    ) {
      results.push(parseItemToNormalized(root, config, originType));
    } else if (Array.isArray(root.classFeatures) || root.hd !== undefined) {
      results.push(parseGenericEntryToNormalized(root, 'class', config, originType));
    } else {
      results.push(parseGenericEntryToNormalized(root, 'adventure', config, originType));
    }
  }

  return results;
}

export interface LiveWebsiteParseHints {
  pageFile?: string;
  title?: string;
  source?: string;
  hash?: string;
  entityJson?: Record<string, any> | null;
}

function mapPageFileToCategory(pageFile?: string): CategoryType | null {
  if (!pageFile) return null;
  const lower = pageFile.toLowerCase();
  if (lower.includes('bestiary')) return 'monster';
  if (lower.includes('spell')) return 'spell';
  if (lower.includes('item')) return 'item';
  if (lower.includes('feat')) return 'feat';
  if (lower.includes('class')) return 'class';
  if (lower.includes('race')) return 'race';
  if (lower.includes('background')) return 'background';
  if (lower.includes('adventure') || lower.includes('book')) return 'adventure';
  return null;
}

function extractTextSpansFromElement(
  el: Element,
  tagOpts: TagParseOptions,
  auditLog: TagTransformationSample[]
): TextSpan[] {
  const spans: TextSpan[] = [];

  function walk(node: Node, bold: boolean, italic: boolean) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent || '';
      if (!raw) return;
      const resolved = resolve5eToolsTags(raw, tagOpts, auditLog);
      if (resolved) {
        spans.push({ text: resolved, bold, italic });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const elem = node as Element;
    const tag = elem.tagName.toLowerCase();

    // Skip hidden/ad/button chrome inside 5eTools statblocks
    if (
      elem.classList.contains('stats-source') ||
      elem.classList.contains('ve-btn') ||
      elem.classList.contains('rd__h-toggle') ||
      tag === 'button' ||
      tag === 'script' ||
      tag === 'style'
    ) {
      return;
    }

    const nextBold = bold || tag === 'b' || tag === 'strong' || elem.classList.contains('bold');
    const nextItalic = italic || tag === 'i' || tag === 'em' || elem.classList.contains('italic');

    if (tag === 'br') {
      spans.push({ text: ' ', bold, italic });
      return;
    }

    for (const child of Array.from(elem.childNodes)) {
      walk(child, nextBold, nextItalic);
    }
  }

  walk(el, false, false);
  return spans;
}

/**
 * Parses live 5eTools Website HTML DOM (`#pagecontent`, `#classtable`, `.stats`, `.rd__b`)
 * or pasted HTML/JSON/plain statblock text into NormalizedEntry[] for 1-click Shard `.docx` conversion.
 */
export function parse5eToolsWebsiteHtmlOrText(
  rawSource: string,
  config: ShardFormattingConfig,
  hints?: LiveWebsiteParseHints
): NormalizedEntry[] {
  const trimmed = rawSource.trim();
  const parser = new DOMParser();
  const doc = trimmed ? parser.parseFromString(trimmed, 'text/html') : null;
  const classTable = doc?.querySelector('table#classtable') || null;

  // Helper to extract class progression table block from DOM if present
  const extractClassTableBlock = (fallbackTitle?: string): DocBlock | null => {
    if (!classTable) return null;
    const headerCells = Array.from(classTable.querySelectorAll('thead th, tr:first-child th')).map((th) =>
      (th.textContent || '').trim()
    );
    const bodyRows: string[][] = [];
    const trs = Array.from(classTable.querySelectorAll('tbody tr'));
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll('td, th')).map((c) => (c.textContent || '').trim());
      if (cells.length > 0 && !cells.every((c) => headerCells.includes(c))) {
        bodyRows.push(cells);
      }
    }
    if (headerCells.length > 0 && bodyRows.length > 0) {
      return {
        type: 'table',
        table: {
          caption: fallbackTitle ? `${fallbackTitle} Class Progression` : 'Class Progression',
          headers: headerCells,
          rows: bodyRows,
        },
      };
    }
    return null;
  };

  // 0. If the live 5eTools iframe bridge passed the exact in-memory entity JSON from window.dbg_page
  if (hints?.entityJson && typeof hints.entityJson === 'object') {
    const rawEntity = hints.entityJson;
    if (rawEntity._shardforgeType === 'class' && rawEntity.classObj) {
      const classEntry = parseGenericEntryToNormalized(
        rawEntity.classObj,
        'class',
        config,
        'website-html',
        undefined,
        Array.isArray(rawEntity.activeSubclasses) ? rawEntity.activeSubclasses : undefined
      );
      const tblBlock = extractClassTableBlock(classEntry.name);
      if (tblBlock) {
        // Insert progression table right after the initial key-value / subtitle metadata
        const insertIdx = classEntry.blocks.findIndex(
          (b) => b.type !== 'subtitle' && b.type !== 'key-value'
        );
        if (insertIdx === -1) {
          classEntry.blocks.push(tblBlock);
        } else {
          classEntry.blocks.splice(insertIdx, 0, tblBlock);
        }
      }
      return [classEntry];
    }

    const pageCat = mapPageFileToCategory(hints.pageFile);
    if (rawEntity.name) {
      if (pageCat === 'monster') {
        return [parseMonsterToNormalized(rawEntity, config, 'website-html')];
      }
      if (pageCat === 'spell') {
        return [parseSpellToNormalized(rawEntity, config, 'website-html')];
      }
      if (pageCat === 'item') {
        return [parseItemToNormalized(rawEntity, config, 'website-html')];
      }
      if (pageCat === 'feat' || pageCat === 'race' || pageCat === 'background') {
        return [parseGenericEntryToNormalized(rawEntity, pageCat, config, 'website-html')];
      }
      const fromEntity = parse5eToolsJsonPayload(rawEntity, config, 'website-html');
      if (fromEntity.length > 0) return fromEntity;
    }
  }

  if (!trimmed || !doc) return [];

  // First check if rawSource string is JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const fromJson = parse5eToolsJsonPayload(parsed, config, 'custom-json');
      if (fromJson.length > 0) return fromJson;
    } catch {
      // Fall through to HTML/Text parser
    }
  }

  const auditLog: TagTransformationSample[] = [];
  const tagOpts: TagParseOptions = { includeDiceAverages: config.includeDiceAverages };

  const isHtmlInput = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  const blocks: DocBlock[] = [];

  // Extract entry title & source cleanly (supporting both .ve-stats and legacy .stats)
  const sourceEl = doc.querySelector('.ve-stats__h-source-abbreviation, .stats-source');
  const extractedSource = (hints?.source || sourceEl?.textContent || '').trim() || '5eTools';

  const nameEl = doc.querySelector(
    '.ve-stats__h-name, .ve-stats__th-name .stats-name, .stats-name, th.rnd-name h1, th.rnd-name span, .rd__h--0, h1'
  );
  let entryTitle = (nameEl?.textContent || hints?.title || '').trim();
  if (sourceEl && entryTitle.endsWith(sourceEl.textContent || '')) {
    entryTitle = entryTitle.slice(0, entryTitle.length - (sourceEl.textContent || '').length).trim();
  }

  let detectedCategory: CategoryType = mapPageFileToCategory(hints?.pageFile) || 'monster';

  // If HTML contains 5eTools #pagecontent / .stats / .ve-stats table rows or .rd__b structures, parse structurally
  const statTable = doc.querySelector('table.ve-stats, table.stats, table#pagecontent');

  const tblBlock = extractClassTableBlock(entryTitle);
  if (tblBlock) {
    blocks.push(tblBlock);
  }

  if (isHtmlInput && statTable) {
    const rows = Array.from(statTable.querySelectorAll(':scope > tbody > tr, :scope > tr'));
    let pendingAbilityHeaders = false;

    for (const tr of rows) {
      // Skip the header title row and top/bottom border rows
      if (
        (tr.querySelector('th.ve-stats__th-name, th.rnd-name, .stats-name, .ve-stats__h-name') &&
          !tr.querySelector('td')) ||
        tr.querySelector('th.ve-tbl-border, td.ve-tbl-border')
      ) {
        continue;
      }
      if (
        tr.classList.contains('border') ||
        tr.querySelector('td.divider, td.ve-tbl-divider, div.ve-tbl-divider')
      ) {
        blocks.push({ type: 'divider' });
        continue;
      }

      const cells = Array.from(tr.children).filter(
        (c) => c.tagName === 'TH' || c.tagName === 'TD'
      ) as HTMLElement[];

      if (cells.length === 0) continue;

      // Detect 6-column ability score header row (STR DEX CON INT WIS CHA)
      const cellTexts = cells.map((c) => (c.textContent || '').trim());
      if (
        cells.length === 6 &&
        cellTexts.map((t) => t.toUpperCase()).join('|') === 'STR|DEX|CON|INT|WIS|CHA'
      ) {
        pendingAbilityHeaders = true;
        continue;
      }

      if (pendingAbilityHeaders && cells.length === 6) {
        pendingAbilityHeaders = false;
        const parsedNums = cellTexts.map((t) => {
          const m = t.match(/(\d{1,2})/);
          return m ? Number(m[1]) : 10;
        });
        blocks.push({
          type: 'ability-array',
          scores: {
            str: parsedNums[0],
            dex: parsedNums[1],
            con: parsedNums[2],
            int: parsedNums[3],
            wis: parsedNums[4],
            cha: parsedNums[5],
          },
        });
        continue;
      }

      for (const cell of cells) {
        const rawCellText = (cell.textContent || '').trim();
        if (!rawCellText) continue;

        // Check for subsection headers inside td (Actions, Bonus Actions, Reactions, Legendary Actions, etc.)
        const sectHeader = cell.querySelector('h3, h4, .stats__sect-header-inner');
        if (sectHeader) {
          const hText = (sectHeader.textContent || '').trim();
          if (hText) {
            blocks.push({
              type: 'heading',
              level: config.subsectionHeadingLevel,
              text: hText,
              shardRole: 'subsection',
            });
          }
          continue;
        }

        // Check for read-aloud / inset boxes
        const insetEl = cell.querySelector('.rd__b-inset, .rd__b-inset--readaloud, .rd__quote');
        if (insetEl) {
          const pTexts = Array.from(insetEl.querySelectorAll('p, div.rd__p-cont')).map((p) =>
            extractTextSpansFromElement(p, tagOpts, auditLog)
          );
          const validParas = pTexts.filter((sp) => sp.length > 0);
          if (validParas.length > 0) {
            blocks.push({
              type: 'inset',
              readAloud: insetEl.classList.contains('rd__b-inset--readaloud'),
              paragraphs: validParas,
            });
            continue;
          }
        }

        // Check for embedded tables (Wild Magic, Class sub-tables, Adventure encounters)
        const innerTable = cell.querySelector('table');
        if (innerTable) {
          const headers = Array.from(innerTable.querySelectorAll('thead th')).map((th) =>
            (th.textContent || '').trim()
          );
          const tRows = Array.from(innerTable.querySelectorAll('tbody tr')).map((r) =>
            Array.from(r.querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
          );
          if (tRows.length > 0) {
            blocks.push({
              type: 'table',
              table: {
                caption: innerTable.querySelector('caption')?.textContent?.trim(),
                headers,
                rows: tRows,
              },
            });
            continue;
          }
        }

        // Check for Key-Value stat lines
        const kvMatch = rawCellText.match(
          /^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Vulnerabilities|Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus|Casting Time|Range|Components|Duration|Classes)\s*:?\s+(.+)$/i
        );
        if (kvMatch) {
          blocks.push({
            type: 'key-value',
            label: kvMatch[1],
            value: resolve5eToolsTags(kvMatch[2], tagOpts, auditLog),
          });
          continue;
        }

        // Check for standalone italic subtitle (e.g., "Huge dragon, chaotic evil" or "3rd-level evocation")
        const onlyChild = cell.children.length === 1 ? cell.children[0] : null;
        if (
          onlyChild &&
          (onlyChild.tagName === 'I' || onlyChild.tagName === 'EM' || onlyChild.classList.contains('mon__type')) &&
          blocks.length === 0
        ) {
          blocks.push({ type: 'subtitle', text: rawCellText });
          continue;
        }

        // Walk child paragraphs / lists / feature items inside rich 5eTools .rd__b cells
        const childBlocks = Array.from(cell.querySelectorAll(':scope > div, :scope > p, :scope > ul, :scope > ol'));
        if (childBlocks.length > 0) {
          for (const childEl of childBlocks) {
            const tag = childEl.tagName.toLowerCase();
            if (tag === 'ul' || tag === 'ol') {
              const items = Array.from(childEl.querySelectorAll('li')).map((li) =>
                extractTextSpansFromElement(li, tagOpts, auditLog)
              );
              if (items.length > 0) blocks.push({ type: 'list', items });
              continue;
            }
            const subHead = childEl.querySelector(':scope > .rd__h, :scope > h3, :scope > h4');
            if (subHead) {
              blocks.push({
                type: 'heading',
                level: config.subsectionHeadingLevel,
                text: (subHead.textContent || '').trim(),
                shardRole: 'subsection',
              });
            }
            const spans = extractTextSpansFromElement(childEl, tagOpts, auditLog);
            if (spans.length > 0) {
              const plain = spans.map((s) => s.text).join('').trim();
              if (plain) blocks.push({ type: 'paragraph', spans });
            }
          }
          continue;
        }

        // Check if cell starts with bold trait/action name: <b>Multiattack.</b> ...
        const firstBold = cell.querySelector(':scope > b, :scope > strong, :scope > span.rd__b-special > b');
        if (firstBold && rawCellText.startsWith((firstBold.textContent || '').trim())) {
          const bName = (firstBold.textContent || '').trim().replace(/\.$/, '');
          const fullSpans = extractTextSpansFromElement(cell, tagOpts, auditLog);
          // Remove leading feature name from spans if duplicated
          const restText = rawCellText.slice((firstBold.textContent || '').length).trim();
          blocks.push({
            type: 'feature-item',
            name: bName,
            spans: restText ? parseSpansFromResolvedText(restText, tagOpts, auditLog) : fullSpans,
          });
          continue;
        }

        const spans = extractTextSpansFromElement(cell, tagOpts, auditLog);
        if (spans.length > 0) {
          blocks.push({ type: 'paragraph', spans });
        }
      }
    }
  } else {
    // Fallback line-based parser for copied text or non-table HTML (e.g. Adventure chapters / Classes)
    const rawLines = (doc.body.innerText || doc.body.textContent || trimmed)
      .split(/\r?\n/)
      .map((line) => resolve5eToolsTags(line.trim(), tagOpts, auditLog))
      .filter(Boolean);

    if (!entryTitle && rawLines.length > 0) {
      entryTitle = rawLines[0];
    }

    const joinedText = rawLines.join('\n');
    if (!mapPageFileToCategory(hints?.pageFile)) {
      if (/Casting Time:|Components:|Cantrip|\d(st|nd|rd|th)-level/i.test(joinedText)) {
        detectedCategory = 'spell';
      } else if (/Wondrous item|requires attunement|Weapon \(|Armor \(/i.test(joinedText)) {
        detectedCategory = 'item';
      } else if (/Armor Class|Hit Points|Challenge/i.test(joinedText)) {
        detectedCategory = 'monster';
      }
    }

    const startIndex = rawLines[0] === entryTitle ? 1 : 0;
    let i = startIndex;

    while (i < rawLines.length) {
      const line = rawLines[i];

      if (/^(Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions|Lair Actions|Traits|At Higher Levels)$/i.test(line)) {
        blocks.push({
          type: 'heading',
          level: config.subsectionHeadingLevel,
          text: line,
          shardRole: 'subsection',
        });
        i++;
        continue;
      }

      if (
        i === startIndex &&
        (/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+/i.test(line) ||
          /level\s+\w+|cantrip|Wondrous item|Prerequisite:/i.test(line))
      ) {
        blocks.push({ type: 'subtitle', text: line });
        i++;
        continue;
      }

      const kvMatch = line.match(
        /^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Vulnerabilities|Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus|Casting Time|Range|Components|Duration)\s*:?\s+(.+)$/i
      );
      if (kvMatch) {
        blocks.push({
          type: 'key-value',
          label: kvMatch[1],
          value: kvMatch[2],
        });
        i++;
        continue;
      }

      if (/^STR\b/i.test(line)) {
        const windowText = rawLines.slice(i, i + 12).join(' ');
        const nums = Array.from(windowText.matchAll(/\b(\d{1,2})\s*\([+-−]?\d+\)/g)).map((m) => Number(m[1]));
        if (nums.length >= 6) {
          blocks.push({
            type: 'ability-array',
            scores: {
              str: nums[0],
              dex: nums[1],
              con: nums[2],
              int: nums[3],
              wis: nums[4],
              cha: nums[5],
            },
          });
          while (i < rawLines.length && /^(STR|DEX|CON|INT|WIS|CHA|\d{1,2}\s*\([+-−]?\d+\))/i.test(rawLines[i])) {
            i++;
          }
          continue;
        }
      }

      const traitMatch = line.match(/^([A-Z][A-Za-z0-9\s'()/–-]{1,42})\.\s+(.+)$/);
      if (traitMatch) {
        blocks.push({
          type: 'feature-item',
          name: traitMatch[1],
          spans: parseSpansFromResolvedText(traitMatch[2], tagOpts, auditLog),
        });
        i++;
        continue;
      }

      blocks.push({
        type: 'paragraph',
        spans: parseSpansFromResolvedText(line, tagOpts, auditLog),
      });
      i++;
    }
  }

  // Refine category detection if still ambiguous
  const allText = blocks.map((b) => ('value' in b ? b.value : 'text' in b ? b.text : '')).join(' ');
  if (!mapPageFileToCategory(hints?.pageFile)) {
    if (/Casting Time|Components/i.test(allText)) detectedCategory = 'spell';
    else if (/Armor Class|Hit Points|Challenge/i.test(allText)) detectedCategory = 'monster';
  }

  const finalName = entryTitle || 'Clipped 5eTools Entry';
  const stableId = `live-${detectedCategory}-${finalName}-${extractedSource}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');

  return [
    {
      id: stableId,
      name: finalName,
      category: detectedCategory,
      source: extractedSource,
      summaryMeta: `Live 5eTools · ${detectedCategory.toUpperCase()} · ${extractedSource}`,
      badgeCode: detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1),
      blocks,
      rawSourceSnippet: trimmed,
      tagTransformations: auditLog,
      originType: 'website-html',
    },
  ];
}
