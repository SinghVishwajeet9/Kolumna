import { Header } from "@/components/Header";

// Chrome for the authenticated app (/boards, /b/[id], ...). The marketing
// landing page renders its own nav instead.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
