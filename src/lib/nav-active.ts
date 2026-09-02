/**
 * Active state for dashboard nav links.
 * Create highlights both photo and reel studios; the posts library is `/content` only.
 */
export function isNavHrefActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  if (href === "/content/photo") {
    return (
      pathname.startsWith("/content/photo") ||
      pathname.startsWith("/content/reel")
    );
  }

  if (href === "/content") {
    return pathname === "/content";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Parent crumb for `/content`: studio routes say "Create", the posts list says "Library". */
export function contentSectionCrumbLabel(
  pathname: string,
  labels: { createContent: string; library: string }
): string {
  const isCreator =
    pathname.startsWith("/content/photo") || pathname.startsWith("/content/reel");
  return isCreator ? labels.createContent : labels.library;
}
