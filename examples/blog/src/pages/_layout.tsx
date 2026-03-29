import type { LayoutProps } from "anpan";
import ThemeToggle from "../components/ThemeToggle.island";

export default function RootLayout({ children, url }: LayoutProps) {
  const path = url.pathname;

  function navLink(href: string, label: string) {
    const active = path === href || (href !== "/" && path.startsWith(href));
    return (
      <a href={href} class={active ? "nav-link active" : "nav-link"}>
        {label}
      </a>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header class="site-header">
          <div class="container">
            <a href="/" class="site-title">Bun Blog</a>
            <nav class="site-nav">
              {navLink("/", "Home")}
              {navLink("/blog", "Posts")}
              {navLink("/about", "About")}
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main class="site-main">
          <div class="container">{children}</div>
        </main>

        <footer class="site-footer">
          <div class="container">
            <p>Built with anpan. No React needed.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
