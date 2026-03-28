import { describe, test, expect } from "bun:test";
import { h, Fragment, renderToString, renderToStream } from "../runtime.ts";

describe("renderToString", () => {
  test("renders primitive values", () => {
    expect(renderToString("hello")).toBe("hello");
    expect(renderToString(42)).toBe("42");
    expect(renderToString(null)).toBe("");
    expect(renderToString(undefined)).toBe("");
    expect(renderToString(false)).toBe("");
    expect(renderToString(true)).toBe("");
  });

  test("escapes HTML entities", () => {
    // Single quotes in text content don't need escaping — only &, <, >, " are escaped
    expect(renderToString("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;",
    );
    expect(renderToString('He said "hello"')).toBe('He said &quot;hello&quot;');
    expect(renderToString("a & b")).toBe("a &amp; b");
    expect(renderToString("a < b > c")).toBe("a &lt; b &gt; c");
  });

  test("renders a simple element", () => {
    const node = h("div", { className: "foo" }, "Hello");
    expect(renderToString(node)).toBe('<div class="foo">Hello</div>');
  });

  test("renders void tags without closing tag", () => {
    expect(renderToString(h("br", null))).toBe("<br>");
    expect(renderToString(h("img", { src: "/img.png", alt: "img" }))).toBe(
      '<img src="/img.png" alt="img">',
    );
    expect(renderToString(h("input", { type: "text", value: "hi" }))).toBe(
      '<input type="text" value="hi">',
    );
  });

  test("renders boolean attributes", () => {
    expect(renderToString(h("input", { disabled: true, type: "text" }))).toBe(
      '<input disabled type="text">',
    );
    expect(renderToString(h("input", { disabled: false, type: "text" }))).toBe(
      '<input type="text">',
    );
  });

  test("skips event handler props", () => {
    const node = h("button", { onclick: () => {}, className: "btn" }, "Click");
    expect(renderToString(node)).toBe('<button class="btn">Click</button>');
  });

  test("renders nested children", () => {
    const node = h("ul", null,
      h("li", null, "one"),
      h("li", null, "two"),
    );
    expect(renderToString(node)).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  test("renders array children", () => {
    const items = ["a", "b", "c"];
    const node = h("ul", null, ...items.map((i) => h("li", null, i)));
    expect(renderToString(node)).toBe("<ul><li>a</li><li>b</li><li>c</li></ul>");
  });

  test("renders Fragment", () => {
    const node = h(Fragment, null, h("span", null, "1"), h("span", null, "2"));
    expect(renderToString(node)).toBe("<span>1</span><span>2</span>");
  });

  test("renders functional components", () => {
    const Greeting = ({ name }: { name: string }) => h("p", null, `Hello, ${name}!`);
    expect(renderToString(h(Greeting, { name: "World" }))).toBe("<p>Hello, World!</p>");
  });

  test("renders dangerouslySetInnerHTML", () => {
    const node = h("div", { dangerouslySetInnerHTML: { __html: "<b>raw</b>" } });
    expect(renderToString(node)).toBe("<div><b>raw</b></div>");
  });

  test("maps className to class", () => {
    expect(renderToString(h("div", { className: "foo bar" }))).toBe(
      '<div class="foo bar"></div>',
    );
  });

  test("maps htmlFor to for", () => {
    expect(renderToString(h("label", { htmlFor: "myInput" }, "Label"))).toBe(
      '<label for="myInput">Label</label>',
    );
  });
});

describe("renderToStream", () => {
  async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((a, b) => {
      const merged = new Uint8Array(a.length + b.length);
      merged.set(a);
      merged.set(b, a.length);
      return merged;
    }, new Uint8Array(0));
    return new TextDecoder().decode(total);
  }

  test("streams the same output as renderToString", async () => {
    const node = h("div", { className: "foo" },
      h("h1", null, "Title"),
      h("p", null, "Body"),
    );
    const str = renderToString(node);
    const streamed = await collectStream(renderToStream(node));
    expect(streamed).toBe(str);
  });

  test("streams arrive in chunks (not all at once necessarily)", async () => {
    const node = h("ul", null, ...Array.from({ length: 10 }, (_, i) => h("li", null, `Item ${i}`)));
    const stream = renderToStream(node);
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).toBeInstanceOf(Uint8Array);
    reader.cancel();
  });
});
