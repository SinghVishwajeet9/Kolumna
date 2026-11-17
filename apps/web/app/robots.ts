import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines may index the public pages; the signed-in app and invite
// links are private and stay out of results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/boards", "/b/", "/agents", "/approvals", "/members", "/usage", "/activity", "/invite/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
