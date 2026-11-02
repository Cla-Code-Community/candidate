import { Fragment, type ReactNode } from "react";

interface FormattedJobDescriptionProps {
  description: string;
}

const discardedElements = new Set([
  "button",
  "canvas",
  "embed",
  "form",
  "iframe",
  "img",
  "input",
  "link",
  "meta",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
]);

function decodeEncodedMarkup(value: string) {
  let decoded = value;

  for (
    let attempt = 0;
    attempt < 3 && /&(?:amp;)?(?:lt|gt);/i.test(decoded);
    attempt += 1
  ) {
    const document = new DOMParser().parseFromString(decoded, "text/html");
    const nextValue = document.body.textContent ?? decoded;

    if (nextValue === decoded) break;
    decoded = nextValue;
  }

  return decoded;
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function renderNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (discardedElements.has(tag)) {
    return null;
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderNode(child, `${key}-${index}`),
  );

  switch (tag) {
    case "a": {
      const href = safeExternalUrl(element.getAttribute("href"));

      return href ? (
        <a key={key} href={href} target="_blank" rel="noreferrer nofollow">
          {children}
        </a>
      ) : (
        <span key={key}>{children}</span>
      );
    }
    case "br":
      return <br key={key} />;
    case "strong":
    case "b":
      return <strong key={key}>{children}</strong>;
    case "em":
    case "i":
      return <em key={key}>{children}</em>;
    case "h1":
      return <h1 key={key}>{children}</h1>;
    case "h2":
      return <h2 key={key}>{children}</h2>;
    case "h3":
      return <h3 key={key}>{children}</h3>;
    case "h4":
    case "h5":
    case "h6":
      return <h4 key={key}>{children}</h4>;
    case "ul":
      return <ul key={key}>{children}</ul>;
    case "ol":
      return <ol key={key}>{children}</ol>;
    case "li":
      return <li key={key}>{children}</li>;
    case "p":
      return <p key={key}>{children}</p>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "code":
      return <code key={key}>{children}</code>;
    case "pre":
      return <pre key={key}>{children}</pre>;
    case "hr":
      return <hr key={key} />;
    case "div":
      return <div key={key}>{children}</div>;
    default:
      return <Fragment key={key}>{children}</Fragment>;
  }
}

export function FormattedJobDescription({
  description,
}: FormattedJobDescriptionProps) {
  const decodedDescription = decodeEncodedMarkup(description);
  const document = new DOMParser().parseFromString(
    decodedDescription,
    "text/html",
  );
  const hasMarkup = /<\/?[a-z][\s\S]*>/i.test(decodedDescription);

  return (
    <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-background p-4 text-sm leading-6 text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-bold [&_hr]:my-4 [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_strong]:font-bold [&_strong]:text-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
      {hasMarkup ? (
        Array.from(document.body.childNodes).map((node, index) =>
          renderNode(node, String(index)),
        )
      ) : (
        <p className="whitespace-pre-wrap">
          {document.body.textContent ?? decodedDescription}
        </p>
      )}
    </div>
  );
}
