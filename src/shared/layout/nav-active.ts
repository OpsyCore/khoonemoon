export function isBottomNavActive(pathname: string, href: string) {
  if (href === "/home") {
    return (
      pathname === "/home" ||
      pathname.startsWith("/home/") ||
      pathname === "/finance" ||
      pathname.startsWith("/finance/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
