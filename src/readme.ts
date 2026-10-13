import { marked } from "marked";

// README.md links its images relative to the repo root (`docs/before.png`) so
// they render on GitHub. Served at /readme/, a relative path would resolve
// under /readme/ instead, so repo-relative paths get rewritten to absolute
// ones; anything already absolute or pointing off-site is left alone.
function rootRelative(href: string): string {
  if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  return `/${href}`;
}

const renderer = new marked.Renderer();
const baseImage = renderer.image.bind(renderer);
renderer.image = (token) => baseImage({ ...token, href: rootRelative(token.href) });
const baseLink = renderer.link.bind(renderer);
renderer.link = (token) => baseLink({ ...token, href: rootRelative(token.href) });

export function renderReadme(markdown: string): string {
  return marked.parse(markdown, { renderer, async: false }) as string;
}
