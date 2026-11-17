import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Footer } from "@/components/landing/Footer";
import { Frame, Rule, Spacer } from "@/components/landing/Frame";
import {
  AuditSection,
  CTA,
  CrowdStrip,
  HowItWorks,
  SpendAndTrust,
  Statement,
  Teammates,
  WorksWith,
} from "@/components/landing/Sections";

// The landing page. Layout, type and spacing rules: apps/web/DESIGN.md.
// A full-width hero, then one framed 1280px column; sections separated by
// hairlines and spacer strips.
export default function LandingPage() {
  return (
    <div className="landing min-h-screen">
      <Nav />
      <main>
        {/* Full width: no frame lines beside the hero. The frame starts under it. */}
        <Hero />
        <Frame>
          <Rule />
          <WorksWith />
          <CrowdStrip />
          <Teammates />
          <Spacer grain />
          <HowItWorks />
          <Spacer hatch />
          <SpendAndTrust />
          <Spacer />
          <AuditSection />
          <Rule />
          <Statement />
          <Rule />
          <CTA />
          <Rule />
          <Footer />
        </Frame>
      </main>
    </div>
  );
}
