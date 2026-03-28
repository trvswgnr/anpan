export interface Post {
  slug: string;
  title: string;
  date: string;       // ISO date string
  summary: string;
  body: string;       // raw HTML (sanitized at the source)
  tags: string[];
  readingTime: number; // minutes
}

// In a real app this would be a DB query or a filesystem read.
// For the example it is hardcoded so the server needs no external services.
export const posts: Post[] = [
  {
    slug: "bun-1-0",
    title: "Bun 1.0 is here",
    date: "2023-09-08",
    summary:
      "Bun reaches 1.0 with a stable API, a built-in test runner, and performance numbers that make Node.js look slow.",
    body: `<p>Bun is a fast JavaScript runtime built on JavaScriptCore. Version 1.0 marks the first stable release.</p>
<p>The headline numbers are striking: HTTP throughput roughly 4x Node.js, startup time under 10ms for small scripts, and a built-in bundler that rivals esbuild.</p>
<h2>What ships in 1.0</h2>
<ul>
  <li>Stable <code>Bun.serve()</code> HTTP server</li>
  <li>Built-in test runner (<code>bun:test</code>)</li>
  <li>Native TypeScript and JSX execution</li>
  <li>Node.js compatibility layer covering ~95% of npm packages</li>
</ul>
<p>The Node.js compatibility story is especially important. Most Express, Fastify, and Hono apps run on Bun without code changes.</p>`,
    tags: ["bun", "javascript", "runtime"],
    readingTime: 3,
  },
  {
    slug: "islands-architecture",
    title: "The islands architecture",
    date: "2023-06-14",
    summary:
      "Ship zero JavaScript by default. Add interactive components exactly where you need them. Islands architecture explained.",
    body: `<p>The term was coined by Jason Miller in 2020. The idea is simple: render pages entirely on the server, then hydrate only the components that need interactivity.</p>
<p>In a traditional SPA you ship a JavaScript bundle for the whole page. In the islands model you ship a bundle only for the interactive parts, which are called islands.</p>
<h2>Why it matters</h2>
<p>A blog post does not need JavaScript. The nav might need a dropdown. The comments section needs a form. Only those two pieces should be hydrated.</p>
<p>Astro popularised this model. Fresh (Deno), Marko, and Qwik follow similar ideas. This framework implements a minimal version: static SSR by default, interactive islands on demand.</p>
<h2>The tradeoff</h2>
<p>Islands components are isolated. They do not share state with each other or with the server-rendered content. If you need shared state across multiple islands, you need a different approach (signals, a global store, or a message bus).</p>`,
    tags: ["architecture", "ssr", "performance"],
    readingTime: 4,
  },
  {
    slug: "why-no-vdom",
    title: "Why this framework skips the virtual DOM",
    date: "2023-11-02",
    summary:
      "React's virtual DOM makes sense for complex client-side apps. For server rendering it mostly gets in the way.",
    body: `<p>The virtual DOM was designed to batch DOM mutations efficiently in the browser. On the server there is no DOM. We are producing a string of HTML.</p>
<p>When you call <code>renderToString()</code> in React, the virtual DOM is constructed in memory and immediately thrown away after serialisation. The diffing machinery never runs. You are paying for infrastructure that does nothing.</p>
<h2>What we do instead</h2>
<p>A VNode in this framework is a plain object: <code>{ type, props }</code>. <code>renderToString()</code> walks it recursively and concatenates strings. No scheduler, no fibers, no reconciler.</p>
<p>The result is fast and simple. The entire renderer fits in about 150 lines of TypeScript.</p>
<h2>The cost</h2>
<p>You lose React's ecosystem: hooks (except our minimal <code>useState</code> for islands), context, refs, suspense, concurrent features. For a content site that is a fine tradeoff. For a complex interactive app you probably want React.</p>`,
    tags: ["internals", "performance", "jsx"],
    readingTime: 5,
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getRecentPosts(n = 5): Post[] {
  return [...posts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export function getPostsByTag(tag: string): Post[] {
  return posts.filter((p) => p.tags.includes(tag));
}

// Simple in-memory like store.
// Keys are slugs, values are counts.
export const likes: Record<string, number> = {
  "bun-1-0": 12,
  "islands-architecture": 8,
  "why-no-vdom": 21,
};
