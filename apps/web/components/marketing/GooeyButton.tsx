import Link from "next/link";

// A link OR button with the gooey hover fill. Styling (font, padding,
// colours) stays with the caller via `className` — this only adds the blob
// layer, so it can wrap any existing control without changing how it looks
// at rest.
//
// Pass `href` for navigation (renders <Link>, or a plain <a> for #anchors).
// Omit `href` to get a real <button> — needed for form submits and onClick
// actions.
export function GooeyButton({
  href,
  type = "button",
  onClick,
  disabled,
  className = "",
  labelClassName = "",
  style,
  children,
}: {
  href?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
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

  // No href → a real button (form submit / onClick action).
  if (!href) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`goo ${className}`}
        style={style}
      >
        {inner}
      </button>
    );
  }

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
