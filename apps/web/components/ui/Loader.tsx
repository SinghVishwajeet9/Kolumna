// The two-dot orbit loader (styles in globals.css, `.chaotic-orbit`).

export function Loader({ size = 25 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="chaotic-orbit"
      style={{ "--uib-size": `${size}px` } as React.CSSProperties}
    />
  );
}

// For a whole page area that has nothing to show yet.
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <Loader />
    </div>
  );
}
