import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

// Auth0 returns the user to the root URL, with the login result in ?code=...&state=... and the original page in
// ?redirect=<path>. The user is sent to that page. The login parameters are kept on the way: the Auth0 provider
// reads them on the target page to finish the sign-in. Only paths on this app are accepted.
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const target = params.redirect;

  if (typeof target === "string" && target.startsWith("/") && !target.startsWith("//")) {
    const forwarded = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "redirect" && typeof value === "string") forwarded.set(key, value);
    }
    const query = forwarded.toString();
    redirect(query ? `${target}?${query}` : target);
  }

  return <div />;
}
