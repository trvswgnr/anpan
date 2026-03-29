import type { LayoutProps } from "../../../src/index.ts";

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* Additional head content injected via HTMLRewriter */}
      </head>
      <body style="font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem;">
        <nav>
          <a href="/">Home</a>
          {" · "}
          <a href="/about">About</a>
          {" · "}
          <a href="/blog/hello-world">Blog post</a>
          {" · "}
          <a href="/counter">Counter island</a>
        </nav>
        <hr />
        <main>{children}</main>
        <hr />
        <footer>
          <small>Powered by anpan</small>
        </footer>
      </body>
    </html>
  );
}
