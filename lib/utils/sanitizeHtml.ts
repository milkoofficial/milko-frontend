/**
 * Very small HTML sanitizer for user-entered rich text.
 * Goal: preserve basic formatting while preventing script injection.
 *
 * NOTE: This runs in the browser (client components). If you also render HTML
 * on the server, you should sanitize there too.
 */

const ALLOWED_TAGS = new Set([
  'B',
  'I',
  'EM',
  'STRONG',
  'U',
  'BR',
  'P',
  'DIV',
  'SPAN',
  'UL',
  'OL',
  'LI',
  'A',
]);

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function textToHtml(text: string) {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

export function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

export function sanitizeHtml(inputHtml: string) {
  // DOMParser only exists in the browser. In non-browser contexts, fall back to escaping.
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(inputHtml);
  }

  const doc = new DOMParser().parseFromString(inputHtml, 'text/html');

  // Remove scripts/styles explicitly
  doc.querySelectorAll('script,style').forEach((n) => n.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const elements: Element[] = [];
  while (walker.nextNode()) {
    elements.push(walker.currentNode as Element);
  }

  for (const el of elements) {
    if (!ALLOWED_TAGS.has(el.tagName)) {
      // unwrap disallowed element (preserve text/children)
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }

    // Remove all attributes except href on <a>
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (el.tagName === 'A' && name === 'href') return;
      el.removeAttribute(attr.name);
    });

    if (el.tagName === 'A') {
      const href = (el.getAttribute('href') || '').trim();
      const safe =
        href.startsWith('/') ||
        href.startsWith('#') ||
        /^https?:\/\//i.test(href);
      if (!safe) el.removeAttribute('href');
      // Safe defaults
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  }

  return doc.body.innerHTML;
}

export function toSafeHtml(input: string) {
  const raw = input || '';
  return looksLikeHtml(raw) ? sanitizeHtml(raw) : textToHtml(raw);
}

