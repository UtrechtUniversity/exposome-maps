// How a dataset is obtained, rendered consistently everywhere:
//   "request"  — Utrecht University dataset, obtained through the request form (UU yellow)
//   "external" — published elsewhere, accessed at the provider (teal)

import { h } from "./util.js";

export const ACCESS_TYPES = {
  request: {
    label: "UU · On request",
    filterLabel: "UU · On request",
    explanation: "Utrecht University data: request it with the form",
    action: "Request access",
  },
  external: {
    label: "External",
    filterLabel: "External",
    explanation: "Published by another organisation: access it at the provider",
    action: "Go to data",
  },
};

export function isExternal(access) {
  return access?.type === "external";
}

/** Coloured badge, e.g. "UU · On request" or "External · RIVM". */
export function accessBadge(access, { withProvider = true } = {}) {
  const type = isExternal(access) ? "external" : "request";
  const text =
    type === "external" && withProvider && access.provider
      ? `${ACCESS_TYPES.external.label} · ${access.provider}`
      : ACCESS_TYPES[type].label;
  return h("span", { class: `access-badge access-badge--${type}` }, text);
}

/** Small coloured dot with an accessible label. */
export function accessDot(access) {
  const type = isExternal(access) ? "external" : "request";
  return h("span", {
    class: `access-dot access-dot--${type}`,
    role: "img",
    "aria-label": ACCESS_TYPES[type].label,
    title: ACCESS_TYPES[type].explanation,
  });
}

/** Primary action: request form (UU) or the provider's page (external, new tab). */
export function accessButton(access, { size = "" } = {}) {
  const type = isExternal(access) ? "external" : "request";
  const sizeClass = size ? ` btn--${size}` : "";
  if (type === "external") {
    return h(
      "a",
      { class: `btn btn--external${sizeClass}`, href: access.url, target: "_blank", rel: "noopener" },
      ACCESS_TYPES.external.action,
      h("span", { "aria-hidden": "true" }, " ↗"),
      h("span", { class: "visually-hidden" }, ` at ${access.provider} (opens in a new tab)`),
    );
  }
  return h(
    "a",
    { class: `btn btn--request${sizeClass}`, href: access.url, target: "_blank", rel: "noopener" },
    ACCESS_TYPES.request.action,
    h("span", { class: "visually-hidden" }, " (request form, opens in a new tab)"),
  );
}
