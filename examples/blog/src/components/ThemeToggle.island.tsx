import { island, useState } from "bun-web-framework/islands";

function ThemeToggle(_props: Record<string, never>) {
  const [dark, setDark] = useState(false);

  function toggle() {
    const next = !dark;
    setDark(next);
    // Apply to <html> so CSS variables cascade
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  return (
    <button
      class="theme-toggle"
      onclick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}

export default island(ThemeToggle, import.meta.path);
