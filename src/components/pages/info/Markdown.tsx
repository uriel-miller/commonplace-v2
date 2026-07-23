import { type ReactNode } from "react";
import { css } from "@/lib/design/css";

/**
 * A small, dependency-free Markdown renderer scoped to the subset used by the
 * info/marketing pages: headings (# .. ####), paragraphs, ordered/unordered
 * lists (one level of nesting via indentation), plus inline **bold** / *italic*.
 *
 * Server-friendly: a pure function of its props, no hooks, no client runtime.
 * Copy is rendered on-brand (Newsreader headings, readable prose).
 */

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; ordered: boolean; items: ListItem[] };

interface ListItem {
  text: string;
  children?: { ordered: boolean; items: ListItem[] };
}

const H_STYLES: Record<number, string> = {
  1: "font-family:'Reckless','Newsreader',serif;font-weight:600;font-size:2.4rem;line-height:1.12;letter-spacing:-0.01em;color:var(--ink);margin:0 0 1.1rem",
  2: "font-family:'Reckless','Newsreader',serif;font-weight:600;font-size:1.55rem;line-height:1.2;color:var(--ink);margin:2.2rem 0 0.7rem",
  3: "font-family:'Roobert','Inter Tight',sans-serif;font-weight:600;font-size:1.12rem;color:var(--ink);margin:1.6rem 0 0.5rem",
  4: "font-family:'Roobert','Inter Tight',sans-serif;font-weight:600;font-size:1rem;color:var(--maroon);margin:1.2rem 0 0.4rem",
};

function parseInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} style={css("font-weight:650;color:var(--ink)")}>
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      nodes.push(
        <em key={`${keyBase}-i${i}`} style={css("font-style:italic")}>
          {m[2]}
        </em>,
      );
    }
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function parseBlocks(md: string): Block[] {
  const rawLines = md.replace(/\r\n/g, "\n").split("\n");

  // Strip HTML comments (single or multi-line).
  const lines: string[] = [];
  let inComment = false;
  for (const line of rawLines) {
    let l = line;
    if (inComment) {
      const end = l.indexOf("-->");
      if (end < 0) continue;
      l = l.slice(end + 3);
      inComment = false;
    }
    const start = l.indexOf("<!--");
    if (start >= 0) {
      const end = l.indexOf("-->", start + 4);
      if (end >= 0) {
        l = l.slice(0, start) + l.slice(end + 3);
      } else {
        l = l.slice(0, start);
        inComment = true;
      }
    }
    lines.push(l);
  }

  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };

  const ulRe = /^(\s*)[-*]\s+(.*)$/;
  const olRe = /^(\s*)\d+\.\s+(.*)$/;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (line.trim() === "") {
      flushPara();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    const isList = ulRe.test(line) || olRe.test(line);
    if (isList) {
      flushPara();
      // Consume the whole contiguous list region.
      const region: string[] = [];
      while (idx < lines.length && (ulRe.test(lines[idx]) || olRe.test(lines[idx]))) {
        region.push(lines[idx]);
        idx += 1;
      }
      idx -= 1; // step back; outer loop will advance
      blocks.push(buildList(region, ulRe, olRe));
      continue;
    }

    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

function buildList(
  region: string[],
  ulRe: RegExp,
  olRe: RegExp,
): Extract<Block, { kind: "list" }> {
  const topOrdered = olRe.test(region[0]);
  const items: ListItem[] = [];

  for (let i = 0; i < region.length; i += 1) {
    const line = region[i];
    const ulM = ulRe.exec(line);
    const olM = olRe.exec(line);
    const m = ulM ?? olM;
    if (!m) continue;
    const indent = m[1].length;

    if (indent === 0) {
      items.push({ text: m[2] });
    } else {
      // Nested item: attach to the last top-level item.
      const parent = items[items.length - 1];
      if (!parent) {
        items.push({ text: m[2] });
        continue;
      }
      if (!parent.children) {
        parent.children = { ordered: Boolean(olM), items: [] };
      }
      parent.children.items.push({ text: m[2] });
    }
  }

  return { kind: "list", ordered: topOrdered, items };
}

function renderItems(items: ListItem[], keyBase: string): ReactNode {
  return items.map((it, i) => {
    const key = `${keyBase}-${i}`;
    return (
      <li key={key} style={css("margin:0 0 0.4rem;padding-left:0.25rem")}>
        {parseInline(it.text, key)}
        {it.children ? (
          it.children.ordered ? (
            <ol style={css("margin:0.4rem 0 0.2rem 1.2rem;padding:0;list-style:decimal")}>
              {renderItems(it.children.items, `${key}-c`)}
            </ol>
          ) : (
            <ul style={css("margin:0.4rem 0 0.2rem 1.2rem;padding:0;list-style:disc")}>
              {renderItems(it.children.items, `${key}-c`)}
            </ul>
          )
        ) : null}
      </li>
    );
  });
}

export function Markdown({ source }: { source: string }): ReactNode {
  const blocks = parseBlocks(source);
  return (
    <div style={css("color:var(--ink)")}>
      {blocks.map((b, i) => {
        const key = `blk-${i}`;
        if (b.kind === "h") {
          const level = Math.min(Math.max(b.level, 1), 4);
          const style = css(H_STYLES[level]);
          const inner = parseInline(b.text, key);
          if (level === 1) return <h1 key={key} style={style}>{inner}</h1>;
          if (level === 2) return <h2 key={key} style={style}>{inner}</h2>;
          if (level === 3) return <h3 key={key} style={style}>{inner}</h3>;
          return <h4 key={key} style={style}>{inner}</h4>;
        }
        if (b.kind === "p") {
          return (
            <p
              key={key}
              style={css(
                "margin:0 0 1rem;font-size:1.02rem;line-height:1.72;color:var(--ink)",
              )}
            >
              {parseInline(b.text, key)}
            </p>
          );
        }
        // list
        const listStyle = css(
          `margin:0 0 1.1rem 1.25rem;padding:0;font-size:1.02rem;line-height:1.6;color:var(--ink);list-style:${b.ordered ? "decimal" : "disc"}`,
        );
        return b.ordered ? (
          <ol key={key} style={listStyle}>
            {renderItems(b.items, key)}
          </ol>
        ) : (
          <ul key={key} style={listStyle}>
            {renderItems(b.items, key)}
          </ul>
        );
      })}
    </div>
  );
}
