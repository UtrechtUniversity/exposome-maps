// Date selection for the active layer: a dropdown (annual/monthly) or a calendar
// (daily), plus previous/next buttons. Values are WMS TIME strings
// (YYYY, YYYY-MM, YYYY-MM-DD) taken from catalogue.json, so no date parsing here.

import { formatTime, h } from "../util.js";

export function createTimeControl({ panel, picker, prev, next, onChange }) {
  let times = [];
  let index = -1;
  let calendar = null;
  let select = null;

  function teardown() {
    calendar?.destroy();
    calendar = null;
    select = null;
    picker.replaceChildren();
  }

  function render(resolution) {
    if (resolution === "Daily" && window.flatpickr) {
      const input = h("input", { type: "text", "aria-label": "Date" });
      picker.append(input);
      calendar = window.flatpickr(input, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j M Y",
        enable: times,
        minDate: times[0],
        maxDate: times[times.length - 1],
        defaultDate: times[index],
        disableMobile: true,
        onChange: (_dates, value) => {
          const i = times.indexOf(value);
          if (i !== -1) go(i);
        },
      });
      calendar.altInput?.setAttribute("aria-label", "Date");
      return;
    }
    select = h(
      "select",
      { "aria-label": resolution === "Annual" ? "Year" : resolution === "Monthly" ? "Month" : "Date" },
      times.map((t) => h("option", { value: t }, formatTime(t))),
    );
    select.value = times[index];
    select.addEventListener("change", () => go(times.indexOf(select.value)));
    picker.append(select);
  }

  function syncUi() {
    if (select) select.value = times[index];
    if (calendar) calendar.setDate(times[index], false);
    prev.disabled = index <= 0;
    next.disabled = index >= times.length - 1;
  }

  function go(i) {
    if (i < 0 || i >= times.length || i === index) return;
    index = i;
    syncUi();
    onChange(times[index]);
  }

  prev.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));

  return {
    /**
     * Load a surface's dates. Keeps `preferred` if available, else picks the latest.
     * @returns {string} the selected time
     */
    setSurface(surface, preferred) {
      teardown();
      times = surface.map.times;
      index = times.includes(preferred) ? times.indexOf(preferred) : times.length - 1;
      render(surface.temporalResolution);
      syncUi();
      // Availability as a tooltip instead of an extra line of text.
      picker.title =
        times.length === 1
          ? `Only available for ${formatTime(times[0])}`
          : `${times.length} dates, ${formatTime(times[0])} – ${formatTime(times[times.length - 1])}`;
      // A single empty time means the layer has no time dimension: no date control.
      panel.hidden = times.length === 1 && !times[0];
      return times[index];
    },

    reset() {
      teardown();
      times = [];
      index = -1;
      panel.hidden = true;
    },
  };
}
