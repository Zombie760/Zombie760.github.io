import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

// DB imports are dynamic inside authorize() so they don't get pulled in
// at module level — middleware runs on Edge which has no fs/better-sqlite3.

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { getUserByEmail, verifyPassword } = await import('../db/users.js');
        const user = getUserByEmail(credentials.email);
        if (!user) return null;

        const valid = await verifyPassword(user, credentials.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
