import { Sidebar } from "@/components/Sidebar";

// Chrome for the authenticated app (/boards, /b/[id], /agents, /activity):
// a left sidebar and the page beside it. The marketing landing page renders
// its own nav instead.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app-ui flex min-h-screen bg-bg">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
