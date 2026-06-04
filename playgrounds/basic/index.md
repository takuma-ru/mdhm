---
lang: ja
head:
  title: mdht Playground
  description: Minimal Markdown SSG playground
  meta:
    - property: og:title
      content: mdht Playground
  link:
    - rel: icon
      href: /assets/favicon.svg
  style: |
    :root {
      --mdht-base: #e11d48;
    }
  script:
    - |
      console.log("mdht playground loaded");
project: mdht
status: playground
features:
  - CommonMark
  - GFM
  - frontmatter
---

# mdht Playground

This page is generated from Markdown by `mdht build`.

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
