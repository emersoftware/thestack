declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        name: string;
        image: string | null;
        emailVerified: boolean;
        createdAt: string;
        updatedAt: string;
        username: string;
        karma: number;
        about: string | null;
        isAdmin: boolean;
        isBanned: boolean;
      } | null;
    }
  }
}

export {};
