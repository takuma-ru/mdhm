import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { getDevReloadScript } from "./constants.js";

type MatterData = Record<string, unknown>;
type HeadData = Record<string, unknown>;
type HastNode = {
  type?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const builtInCss = `
:root {
  --mdht-base: #3b82f6;
  --mdht-bg: canvas;
  --mdht-fg: canvastext;
  --mdht-surface: color-mix(in oklch, var(--mdht-base), var(--mdht-bg) 94%);
  --mdht-muted: color-mix(in oklch, var(--mdht-fg), var(--mdht-bg) 42%);
  --mdht-border: color-mix(in oklch, var(--mdht-base), var(--mdht-bg) 78%);
  --mdht-link: var(--mdht-base);
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --mdht-base: #93c5fd;
    --mdht-surface: color-mix(in oklch, var(--mdht-base), var(--mdht-bg) 90%);
    --mdht-border: color-mix(in oklch, var(--mdht-base), var(--mdht-bg) 70%);
  }
}

* { box-sizing: border-box; }
html { background: var(--mdht-bg); color: var(--mdht-fg); font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6; }
body { margin: 0; }
main { width: min(100% - 2rem, 72ch); margin: 0 auto; padding: 4rem 0; }
article > * + * { margin-block-start: 1rem; }
h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin-block: 2rem 1rem; }
h1 { font-size: clamp(2rem, 8vw, 4rem); letter-spacing: -0.04em; }
h2 { font-size: clamp(1.5rem, 5vw, 2.25rem); letter-spacing: -0.03em; }
a { color: var(--mdht-link); text-underline-offset: 0.2em; }
img, video, svg { max-width: 100%; height: auto; }
pre { overflow-x: auto; padding: 1rem; border: 1px solid var(--mdht-border); border-radius: 0.75rem; background: var(--mdht-surface); }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.92em; }
:not(pre) > code { padding: 0.12em 0.3em; border-radius: 0.35rem; background: var(--mdht-surface); }
blockquote { margin-inline: 0; padding-inline-start: 1rem; border-inline-start: 0.25rem solid var(--mdht-border); color: var(--mdht-muted); }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.5rem; border: 1px solid var(--mdht-border); text-align: start; }
hr { border: 0; border-block-start: 1px solid var(--mdht-border); margin-block: 2rem; }
button { font: inherit; }
body > button { position: fixed; inset-block-end: 0.75rem; inset-inline-end: 0.75rem; z-index: 10; padding: 0.35rem 0.55rem; border: 1px solid var(--mdht-border); border-radius: 999px; background: var(--mdht-surface); color: var(--mdht-fg); font-size: 0.78rem; }
body > pre[hidden] { display: none; }
body > pre:not([hidden]) { position: fixed; inset: 1rem; z-index: 9; overflow: auto; margin: 0; padding: 1rem; border: 1px solid var(--mdht-border); border-radius: 0.75rem; background: var(--mdht-bg); color: var(--mdht-fg); white-space: pre-wrap; }
`;

export async function renderMarkdownFile(
  filePath: string,
  relativePath: string,
  dev: boolean,
): Promise<string> {
  const source = await readFile(filePath, "utf8");
  const parsed = matter(source);
  const markdownHtml = await renderMarkdown(parsed.content);
  return renderDocument({
    contentHtml: markdownHtml,
    data: parsed.data,
    fallbackTitle: path.basename(relativePath, path.extname(relativePath)),
    frontmatterSource: parsed.matter,
    dev,
  });
}

async function renderMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRemoveClasses)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return String(file);
}

function renderDocument(options: {
  contentHtml: string;
  data: MatterData;
  fallbackTitle: string;
  frontmatterSource: string;
  dev: boolean;
}): string {
  const head = isRecord(options.data.head) ? options.data.head : {};
  const lang =
    typeof options.data.lang === "string" && options.data.lang.length > 0
      ? options.data.lang
      : "en";
  const title =
    typeof head.title === "string" && head.title.length > 0 ? head.title : options.fallbackTitle;
  const description = typeof head.description === "string" ? head.description : undefined;
  const frontmatterUi =
    options.frontmatterSource.length > 0 ? renderFrontmatterUi(options.frontmatterSource) : "";

  return `<!doctype html>
<html lang="${escapeAttribute(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${description === undefined ? "" : `<meta name="description" content="${escapeAttribute(description)}">`}
<style>${builtInCss}</style>
${renderHeadExtra(head)}
</head>
<body>
<main>
<article>
${options.contentHtml}
</article>
</main>
${frontmatterUi}
${options.dev ? getDevReloadScript() : ""}
</body>
</html>`;
}

function rehypeRemoveClasses() {
  return (tree: HastNode) => {
    visitHast(tree, (node) => {
      if (node.properties !== undefined) {
        delete node.properties.class;
        delete node.properties.className;
      }
    });
  };
}

function visitHast(node: HastNode, visitor: (node: HastNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visitHast(child, visitor);
  }
}

function renderHeadExtra(head: HeadData): string {
  return [
    renderElementList("meta", head.meta),
    renderElementList("link", head.link),
    renderStyles(head.style),
    renderScripts(head.script),
  ]
    .filter(Boolean)
    .join("\n");
}

function renderElementList(tag: "meta" | "link", value: unknown): string {
  if (value === undefined) {
    return "";
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => {
      if (!isRecord(item)) {
        throw new Error(`head.${tag} entries must be objects`);
      }
      return `<${tag}${renderAttributes(item)}>`;
    })
    .join("\n");
}

function renderStyles(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .map((style) => {
      if (typeof style !== "string") {
        throw new Error("head.style entries must be strings");
      }
      return `<style>${style}</style>`;
    })
    .join("\n");
}

function renderScripts(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .map((script) => {
      if (typeof script === "string") {
        return `<script>${script}</script>`;
      }
      if (!isRecord(script)) {
        throw new Error("head.script entries must be strings or objects");
      }
      if ("content" in script || "children" in script) {
        throw new Error("head.script object entries cannot use content or children");
      }
      return `<script${renderAttributes(script)}></script>`;
    })
    .join("\n");
}

function renderAttributes(attributes: Record<string, unknown>): string {
  const rendered = Object.entries(attributes)
    .map(([name, value]) => renderAttribute(name, value))
    .filter(Boolean);
  return rendered.length === 0 ? "" : ` ${rendered.join(" ")}`;
}

function renderAttribute(name: string, value: unknown): string {
  if (value === true) {
    return escapeAttributeName(name);
  }
  if (value === false || value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return `${escapeAttributeName(name)}="${escapeAttribute(String(value))}"`;
  }
  throw new Error(`Invalid attribute value for ${name}`);
}

function renderFrontmatterUi(frontmatterSource: string): string {
  const id = "mdht-frontmatter";
  return `<button type="button" aria-controls="${id}" onclick="document.getElementById('${id}').toggleAttribute('hidden')">[frontmatter]</button>
<pre id="${id}" hidden>${escapeHtml(frontmatterSource)}</pre>`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function escapeAttributeName(value: string): string {
  if (!/^[A-Za-z_:][A-Za-z0-9:._-]*$/.test(value)) {
    throw new Error(`Invalid attribute name: ${value}`);
  }
  return value;
}
