export interface ADFNode {
  type: string;
  content?: ADFNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
}

export interface ADFDoc {
  type: 'doc';
  version: 1;
  content: ADFNode[];
}

/**
 * Minimal markdown → ADF. Handles paragraphs, bullet lists, and fenced
 * code blocks. Anything else becomes a plain paragraph. Inline marks
 * (bold/italic) are not parsed; the bug-hash layer normalises the body
 * anyway, so faithful round-tripping is unnecessary.
 */
export function markdownToAdf(md: string): ADFDoc {
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const content = blocks.length === 0
    ? [paragraph(' ')]
    : blocks.map(blockToAdf);
  return { type: 'doc', version: 1, content };
}

function blockToAdf(block: string): ADFNode {
  if (/^[-*+]\s/.test(block)) {
    const items = block.split('\n').map((l) => l.replace(/^[-*+]\s/, '').trim()).filter(Boolean);
    return {
      type: 'bulletList',
      content: items.map((t) => ({
        type: 'listItem',
        content: [paragraph(t)],
      })),
    };
  }
  if (block.startsWith('```')) {
    const lines = block.split('\n');
    const lang = lines[0].slice(3).trim();
    const last = lines[lines.length - 1] === '```' ? -1 : undefined;
    const code = lines.slice(1, last).join('\n');
    const node: ADFNode = {
      type: 'codeBlock',
      content: [{ type: 'text', text: code }],
    };
    if (lang) node.attrs = { language: lang };
    return node;
  }
  return paragraph(block);
}

function paragraph(text: string): ADFNode {
  return {
    type: 'paragraph',
    content: text.length > 0 ? [{ type: 'text', text }] : [],
  };
}
