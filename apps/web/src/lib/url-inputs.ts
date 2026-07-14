const URL_INPUT_SELECTOR = 'input[type="url"], input[data-url-input="true"]';

export function normalizeWebUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (/^(mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function prepareInput(input: HTMLInputElement) {
  if (input.dataset.urlToleranceReady === "true") return;
  input.dataset.urlToleranceReady = "true";
  input.dataset.urlInput = "true";
  input.type = "text";
  input.inputMode = "url";
  input.autocapitalize = "none";
  input.setAttribute("autocomplete", "url");
  input.spellcheck = false;
  if (!input.placeholder) input.placeholder = "example.com";
}

function normalizeInput(input: HTMLInputElement) {
  const normalized = normalizeWebUrl(input.value);
  if (normalized !== input.value) {
    input.value = normalized;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function installTolerantUrlInputs() {
  if (typeof document === "undefined") return () => undefined;

  const prepareWithin = (root: ParentNode) => {
    if (root instanceof HTMLInputElement && root.matches(URL_INPUT_SELECTOR)) prepareInput(root);
    root.querySelectorAll<HTMLInputElement>(URL_INPUT_SELECTOR).forEach(prepareInput);
  };

  prepareWithin(document);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) prepareWithin(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const onFocusOut = (event: FocusEvent) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.urlInput === "true") normalizeInput(input);
  };

  const onSubmit = (event: Event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    form.querySelectorAll<HTMLInputElement>('input[data-url-input="true"]').forEach(normalizeInput);
  };

  document.addEventListener("focusout", onFocusOut, true);
  document.addEventListener("submit", onSubmit, true);

  return () => {
    observer.disconnect();
    document.removeEventListener("focusout", onFocusOut, true);
    document.removeEventListener("submit", onSubmit, true);
  };
}
