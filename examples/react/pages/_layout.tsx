import type { LayoutProps } from "@travvy/anpan";

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>React + anpan</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
        <nav>
          <a href="/">Home</a>
        </nav>
        <hr />
        <main>{children}</main>
        <hr />
        <footer>
          <small>Powered by anpan + React</small>
        </footer>
      </body>
    </html>
  );
}
