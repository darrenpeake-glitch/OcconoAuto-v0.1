import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "ADVISOR" | "TECH";
      shopId: string;
      name?: string | null;
      email?: string | null;
    };
  }
}
