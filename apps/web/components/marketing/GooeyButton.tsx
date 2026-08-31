import Link from "next/link";

// A link with the gooey hover fill. Styling (font, padding, colours) stays
// with the caller via `className` — this only adds the blob layer, so it
// can wrap any existing button without changing how it looks at rest.
export function GooeyButton({
  href,
  className = "",
  labelClassName = "",
  style,
  children,
}: {
  href: string;
  className?: string;
  labelClassName?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="goo__blobs" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={`goo__label ${labelClassName}`}>{children}</span>
    </>
  );

  // Same-page anchors get a plain <a>. next/link is for navigation; routing
  // a "#section" jump through it just adds overhead for no benefit.
  if (href.startsWith("#")) {
    return (
      <a href={href} className={`goo ${className}`} style={style}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={`goo ${className}`} style={style}>
      {inner}
    </Link>
  );
}
