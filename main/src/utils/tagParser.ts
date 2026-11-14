import { TagTransformationSample, TextSpan } from '../types/converter';

export interface TagParseOptions {
  includeDiceAverages: boolean;
}

const ATK_MAP: Record<string, string> = {
  mw: 'Melee Weapon Attack:',
  rw: 'Ranged Weapon Attack:',
  ms: 'Melee Spell Attack:',
  rs: 'Ranged Spell Attack:',
  'mw,rw': 'Melee or Ranged Weapon Attack:',
  'ms,rs': 'Melee or Ranged Spell Attack:',
  m: 'Melee Attack:',
  r: 'Ranged Attack:',
};

/**
 * Resolves 5eTools inline {@tag ...} notation into clean SRD text that Shard Tabletop's
 * Content Conversion parser recognizes natively. Also records transformed tags for live inspection.
 */
export function resolve5eToolsTags(
  input: string,
  options: TagParseOptions = { includeDiceAverages: true },
  auditLog?: TagTransformationSample[]
): string {
  if (!input || typeof input !== 'string') return '';

  let text = input;

  // Handle nested tags iteratively (up to 4 passes for nested {@i {@spell ...}})
  for (let pass = 0; pass < 4; pass++) {
    if (!text.includes('{@')) break;

    text = text.replace(/\{@([a-zA-Z0-9]+)(?:\s+([^{}]*))?\}/g, (fullMatch, rawTag: string, rawContent?: string) => {
      const tag = rawTag.toLowerCase();
      const content = (rawContent || '').trim();
      const parts = content.split('|').map((s) => s.trim());
      const first = parts[0] || '';

      let replacement = first;

      switch (tag) {
        case 'atk': {
          replacement = ATK_MAP[first.toLowerCase()] || 'Attack:';
          break;
        }
        case 'hit': {
          const num = parseInt(first, 10);
          if (!Number.isNaN(num)) {
            replacement = num >= 0 ? `+${num}` : `${num}`;
          } else {
            replacement = first.startsWith('+') || first.startsWith('-') ? first : `+${first}`;
          }
          break;
        }
        case 'h': {
          replacement = 'Hit: ';
          break;
        }
        case 'm': {
          replacement = 'Miss: ';
          break;
        }
        case 'hom': {
          replacement = 'Hit or Miss: ';
          break;
        }
        case 'damage':
        case 'dice':
        case 'd20': {
          // Display custom label if present in 2nd or 3rd pipe (e.g. {@dice 1d6|1d6|roll})
          replacement = parts[1] && !/^[A-Z0-9-]+$/.test(parts[1]) ? parts[1] : first;
          break;
        }
        case 'scaledamage':
        case 'scaledice': {
          // Format: {@scaledamage 8d6|3-9|1d6} -> 1d6 (last part is increment)
          replacement = parts[parts.length - 1] || first;
          break;
        }
        case 'dc': {
          replacement = `DC ${first}`;
          break;
        }
        case 'recharge': {
          if (!first || first === '6') {
            replacement = '(Recharge 6)';
          } else {
            replacement = `(Recharge ${first}–6)`;
          }
          break;
        }
        case 'chance': {
          const pct = first;
          const label = parts[1] || `${pct} percent`;
          replacement = label;
          break;
        }
        case 'spell':
        case 'item':
        case 'creature':
        case 'monster':
        case 'condition':
        case 'status':
        case 'skill':
        case 'sense':
        case 'action':
        case 'feat':
        case 'race':
        case 'background':
        case 'class':
        case 'deity':
        case 'disease':
        case 'hazard':
        case 'reward':
        case 'psionic':
        case 'object':
        case 'vehicle':
        case 'trap':
        case 'optfeature':
        case 'language': {
          // Format: {@spell fireball|phb|display text}
          replacement = parts[2] || first;
          break;
        }
        case 'classfeature':
        case 'subclassfeature': {
          // Format: {@classFeature Rage|Barbarian|PHB|1||display text}
          replacement = parts[5] || first;
          break;
        }
        case 'filter': {
          // Format: {@filter wizard spells|spells|level=1|class=Wizard}
          replacement = first;
          break;
        }
        case 'book':
        case 'adventure':
        case 'area': {
          // Format: {@book Player's Handbook|PHB|1|Chapter 1}
          replacement = first;
          break;
        }
        case 'b':
        case 'bold': {
          replacement = `**${first}**`;
          break;
        }
        case 'i':
        case 'italic': {
          replacement = `*${first}*`;
          break;
        }
        case 'bi': {
          replacement = `***${first}***`;
          break;
        }
        case 'u': {
          replacement = first;
          break;
        }
        case 'note': {
          replacement = `(${first})`;
          break;
        }
        case 'footnote': {
          replacement = first;
          break;
        }
        case 'quickref': {
          replacement = parts[4] || first;
          break;
        }
        default: {
          replacement = parts[2] || first;
          break;
        }
      }

      if (auditLog && auditLog.length < 30) {
        const cleanResolved = replacement.replace(/\*\*/g, '').replace(/\*/g, '');
        if (!auditLog.some((item) => item.rawTag === fullMatch)) {
          auditLog.push({
            rawTag: fullMatch,
            resolvedText: cleanResolved,
            tagType: `@${tag}`,
          });
        }
      }

      return replacement;
    });
  }

  // Optionally strip dice averages like "15 (2d10 + 4)" -> "2d10 + 4" if user disables averages
  if (!options.includeDiceAverages) {
    text = text.replace(/\b\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/g, '$1');
  }

  return text;
}

/**
 * Converts a string with lightweight markdown markers (***bold italic***, **bold**, *italic*)
 * produced by 5eTools tag resolution into structured TextSpan[] for React and DOCX rendering.
 */
export function parseSpansFromResolvedText(
  rawText: string,
  options: TagParseOptions = { includeDiceAverages: true },
  auditLog?: TagTransformationSample[]
): TextSpan[] {
  // First mark spells in italics if not already marked
  const premarked = rawText.replace(/\{@spell\s+([^{}|]+)(?:\|[^{}|]*)*\}/gi, (_m, spellName: string) => {
    if (auditLog && auditLog.length < 30 && !auditLog.some((a) => a.rawTag === _m)) {
      auditLog.push({ rawTag: _m, resolvedText: spellName.trim(), tagType: '@spell' });
    }
    return `*${spellName.trim()}*`;
  });

  const resolved = resolve5eToolsTags(premarked, options, auditLog);
  const spans: TextSpan[] = [];

  const tokenRegex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(resolved)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: resolved.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('***') && token.endsWith('***')) {
      spans.push({ text: token.slice(3, -3), bold: true, italic: true });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      spans.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      spans.push({ text: token.slice(1, -1), italic: true });
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < resolved.length) {
    spans.push({ text: resolved.slice(lastIndex) });
  }

  return spans.length > 0 ? spans : [{ text: resolved }];
}

export function spansToPlainText(spans: TextSpan[]): string {
  return spans.map((s) => s.text).join('');
}

export function formatModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
