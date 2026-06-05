import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempSite, createTempSite, readText, runMdht, writeText } from "./test/helpers.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await cleanupTempSite(tempDir);
    tempDir = undefined;
  }
});

describe("Markdown and HTML rendering", () => {
  it("renders CommonMark, GFM, raw HTML, and does not rewrite Markdown links", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `# Home

| Feature | Status |
| - | - |
| GFM | ~~old~~ new |

- [x] Done
- [ ] Todo

<span>raw html</span>

[Markdown link](./about.md)
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "index.html"));

    expect(result.code).toBe(0);
    expect(html).toContain("<table>");
    expect(html).toContain("<del>old</del> new");
    expect(html).toContain('<input type="checkbox" checked disabled>');
    expect(html).toContain('<input type="checkbox" disabled>');
    expect(html).toContain("<p><span>raw html</span></p>");
    expect(html).toContain('<a href="./about.md">Markdown link</a>');
    expect(html).not.toContain("class=");
  });

  it("emits the document skeleton, minimal CSS variables, and fallback title", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(path.join(rootDir, "nested", "foo.md"), "# Foo");

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "nested", "foo.html"));

    expect(result.code).toBe(0);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain("<title>foo</title>");
    expect(html).toContain("<main>");
    expect(html).toContain("<article>");
    expect(html).toContain("--mdhm-base");
    expect(html).toContain("--mdhm-bg");
    expect(html).toContain("--mdhm-fg");
    expect(html).toContain("--mdhm-muted");
    expect(html).toContain("--mdhm-border");
    expect(html).toContain("--mdhm-surface");
    expect(html).toContain("--mdhm-link");
    expect(html).toContain("color-mix(");
    expect(html).toContain("prefers-color-scheme: dark");
  });

  it("renders lang and head fields while preserving original YAML in fixed UI", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `---
lang: ja
head:
  title: My Page
  description: Page description
  meta:
    - name: author
      content: kcatt
    - property: og:title
      content: My Page
  link:
    - rel: icon
      href: /favicon.svg
  style:
    - |
      :root { --mdhm-base: #3b82f6; }
  script:
    - src: /app.js
      type: module
      defer: true
    - |
      console.log("inline script");
custom: value
---

# Body
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "index.html"));

    expect(result.code).toBe(0);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("<title>My Page</title>");
    expect(html).toContain('<meta name="description" content="Page description">');
    expect(html).toContain('<meta name="author" content="kcatt">');
    expect(html).toContain('<meta property="og:title" content="My Page">');
    expect(html).toContain('<link rel="icon" href="/favicon.svg">');
    expect(html).toContain("<style>:root { --mdhm-base: #3b82f6; }");
    expect(html).toContain('<script src="/app.js" type="module" defer></script>');
    expect(html).toContain('<script>console.log("inline script");');
    expect(html).toContain(">[frontmatter]</button>");
    expect(html).toContain("lang: ja");
    expect(html).toContain("custom: value");
    expect(html).toContain("<h1>Body</h1>");
  });

  it("shows the frontmatter button even when frontmatter only contains head and lang", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `---
lang: en
head:
  title: Only Head
---

# Body
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "index.html"));

    expect(result.code).toBe(0);
    expect(html).toContain(">[frontmatter]</button>");
  });

  it("does not show the frontmatter button when no frontmatter exists", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(path.join(rootDir, "index.md"), "# No Frontmatter");

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "index.html"));

    expect(result.code).toBe(0);
    expect(html).not.toContain(">[frontmatter]</button>");
  });

  it("fails with exit code 1 for invalid frontmatter", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `---
head:
  title: Bad
  - invalid
---

# Bad
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);

    expect(result.code).toBe(1);
  });

  it("fails for object and array head attribute values", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `---
head:
  meta:
    - name: nested
      content:
        value: invalid
---

# Bad Attr
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);

    expect(result.code).toBe(1);
  });

  it("renders head attribute booleans, numbers, arbitrary keys, duplicate meta, and mixed style/script arrays", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `---
head:
  title: Attrs
  meta:
    - name: viewport
      content: duplicate viewport
    - data-count: 123
      data-enabled: true
      data-disabled: false
      data-empty:
  link:
    - rel: preload
      href: /asset.js
      as: script
      data-priority: high
  style:
    - |
      :root { --mdhm-base: red; }
    - |
      a { text-decoration-thickness: 2px; }
  script:
    - src: /one.js
      type: module
      defer: true
      async: false
      data-id: 7
    - |
      console.log("mixed");
---

# Attrs
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "index.html"));
    const headHtml = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));

    expect(result.code).toBe(0);
    expect(headHtml.match(/name="viewport"/g)).toHaveLength(2);
    expect(headHtml).toContain('<meta data-count="123" data-enabled>');
    expect(headHtml).not.toContain("data-disabled");
    expect(headHtml).not.toContain("data-empty");
    expect(headHtml).toContain(
      '<link rel="preload" href="/asset.js" as="script" data-priority="high">',
    );
    expect(headHtml).toContain("<style>:root { --mdhm-base: red; }");
    expect(headHtml).toContain("<style>a { text-decoration-thickness: 2px; }");
    expect(headHtml).toContain('<script src="/one.js" type="module" defer data-id="7"></script>');
    expect(headHtml).not.toContain("async");
    expect(headHtml).toContain('<script>console.log("mixed");');
  });

  it("rejects array attribute values and script object inline content fields", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const arrayOutDir = path.join(tempDir, "array-dist");
    const contentOutDir = path.join(tempDir, "content-dist");

    await writeText(
      path.join(rootDir, "array.md"),
      `---
head:
  meta:
    - name: invalid
      content:
        - array
---

# Array
`,
    );
    await writeText(
      path.join(rootDir, "content.md"),
      `---
head:
  script:
    - content: console.log("invalid")
---

# Content
`,
    );

    const arrayResult = await runMdht(["build", "--root-dir", rootDir, "--out-dir", arrayOutDir]);

    await writeText(path.join(rootDir, "array.md"), "# Valid now");
    const contentResult = await runMdht([
      "build",
      "--root-dir",
      rootDir,
      "--out-dir",
      contentOutDir,
    ]);

    expect(arrayResult.code).toBe(1);
    expect(contentResult.code).toBe(1);
  });

  it("does not support MDX or custom directive syntax as special syntax", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(
      path.join(rootDir, "index.md"),
      `# Syntax

<Component prop={value} />

::note
custom directive
::
`,
    );

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);
    const html = await readText(path.join(outDir, "index.html"));

    expect(result.code).toBe(0);
    expect(html).toContain("<Component prop={value} />");
    expect(html).toContain("<p>::note");
    expect(html).toContain("custom directive");
  });
});
