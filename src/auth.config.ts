import type { NextAuthConfig } from "next-auth";
import {
  isPastViewerAllowedPath,
  isPastViewerEmail,
} from "@/lib/past-owner";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;
      const isLoginPage = pathname.startsWith("/login");
      const isPastViewer = isPastViewerEmail(auth?.user?.email);

      if (isLoginPage) {
        if (isLoggedIn) {
          const dest = isPastViewer ? "/analytics/past" : "/";
          return Response.redirect(new URL(dest, request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      if (isPastViewer && !isPastViewerAllowedPath(pathname)) {
        return Response.redirect(new URL("/analytics/past", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (session.user && typeof token.email === "string") {
        session.user.email = token.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
