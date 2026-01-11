import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function NavBar() {
  const session = await getServerSession(authOptions);
  return (
    <header className="border-b bg-white">
      <div className="container flex items-center justify-between py-4">
        <Link href="/board" className="text-lg font-semibold">
          OcconoAuto
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/board" className="text-muted-foreground hover:text-foreground">
            Board
          </Link>
          <Link href="/tech" className="text-muted-foreground hover:text-foreground">
            Tech View
          </Link>
          {session?.user ? (
            <form action="/api/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          ) : (
            <Link href="/signin" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
