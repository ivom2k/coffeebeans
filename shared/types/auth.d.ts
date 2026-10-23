// The sealed session cookie (nuxt-auth-utils). `secure` never leaves the server. `user` reaches
// the browser through /api/_auth/session and stays an empty object: nothing about the person
// is shown (decisions log §5), and its presence alone makes useUserSession().loggedIn true.
declare module '#auth-utils' {
  interface SecureSessionData {
    userId: number;
  }
}

export {};
