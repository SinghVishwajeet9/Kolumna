// Where to go after login/signup (e.g. back to an invite link). Only same-site
// paths are accepted: "/invite/abc" yes, "https://evil.example" or
// "//evil.example" no — otherwise ?next= becomes an open redirect.
export function safeNext(value: string | null, fallback = "/boards") {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
