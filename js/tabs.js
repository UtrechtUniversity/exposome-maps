// Accessible tabs for the top-level views (Map / Catalogue / Open data).

export function createTabs(tablist, { onChange }) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  let current = tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.view;

  function select(view, { focus = false, notify = true } = {}) {
    const tab = tabs.find((t) => t.dataset.view === view);
    if (!tab) return;
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
    }
    if (focus) tab.focus();
    const changed = view !== current;
    current = view;
    if (notify) onChange(view, { changed });
  }

  tablist.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab.dataset.view);
  });

  tablist.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    const nextIndex = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    select(tabs[nextIndex].dataset.view, { focus: true });
  });

  return {
    select,
    get current() {
      return current;
    },
  };
}
