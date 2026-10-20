import { PageLoader } from "@/components/ui/Loader";

// Shown by Next.js while navigating between logged-in pages (the sidebar
// stays put; only the page area swaps to the loader).
export default function Loading() {
  return (
    <main className="min-h-screen bg-bg">
      <PageLoader />
    </main>
  );
}
