---
lang: ja
head:
  title: mdhm Playground
  description: Minimal Markdown SSG playground
  meta:
    - property: og:title
      content: mdhm Playground
  link:
    - rel: icon
      href: /assets/favicon.svg
  style: |
    :root {
      --mdhm-base: #e11d48;
    }
  script:
    - |
      console.log("mdhm playground loaded");
project: mdhm
status: playground
features:
  - CommonMark
  - GFM
  - frontmatter
---

# mdhm Playground

This page is generated from Markdown by `mdhm build`.

## GFM

| Feature       | Status      |
| ------------- | ----------- |
| Tables        | Works       |
| Task lists    | Works       |
| Strikethrough | ~~Old~~ New |

- [x] Build Markdown
- [x] Copy assets
- [ ] Ship it

## Raw HTML

<strong>Raw HTML is allowed.</strong>

## Links

Markdown links are not rewritten: [About](./about.html).

![Sample asset](./assets/sample.svg)
