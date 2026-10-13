import Image from "next/image";

// Shared chrome for /login and /signup: a plain dark ground (same palette as
// the landing page), the auth card centered on it, and the pixel-sparkles in
// two corners. Each page renders its own card into the middle.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-bg items-center justify-center overflow-hidden px-6 py-16">
      <Image
        src="/star.png"
        alt=""
        aria-hidden="true"
        width={320}
        height={320}
        className="pointer-events-none absolute select-none"
        style={{ top: "40px", right: "56px", width: "150px", height: "auto" }}
      />
      <Image
        src="/star.png"
        alt=""
        aria-hidden="true"
        width={320}
        height={320}
        className="pointer-events-none absolute select-none"
        style={{ bottom: "40px", left: "56px", width: "96px", height: "auto" }}
      />
      {children}
    </div>
  );
}
