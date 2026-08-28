export function isBottomNavActive(pathname: string, href: string) {
  if (href === "/home") {
    return (
      pathname === "/home" ||
      pathname.startsWith("/home/") ||
      pathname === "/finance" ||
      pathname.startsWith("/finance/") ||
      pathname === "/documents" ||
      pathname.startsWith("/documents/")
    );
  }

  if (href === "/profile") {
    return (
      pathname === "/profile" ||
      pathname.startsWith("/profile/") ||
      pathname === "/settings" ||
      pathname.startsWith("/settings/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
