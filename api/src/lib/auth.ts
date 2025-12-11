import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { Resend } from 'resend';
import * as schema from '../db/schema';

export type Env = {
  DB: D1Database;
  ENVIRONMENT: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  FRONTEND_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
};

export const createAuth = (env: Env) => {
  const db = drizzle(env.DB, { schema });
  const resend = new Resend(env.RESEND_API_KEY);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },

    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        const verificationUrl = new URL(url);
        verificationUrl.searchParams.set('callbackURL', env.FRONTEND_URL);
        const finalUrl = verificationUrl.toString();

        await resend.emails.send({
          from: 'the stack <noreply@thestack.cl>',
          to: user.email,
          subject: 'Verifica tu email - the stack',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background: #f5f5f5;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <img src="https://thestack.cl/icon.png" alt="the stack" width="40" height="40" style="display: block; border-radius: 6px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <h1 style="color: #141414; font-size: 24px; font-weight: 400; margin: 0;">
                      Bienvenido a <strong>the stack</strong>
                    </h1>
                  </td>
                </tr>
              </table>
              <p style="color: #525252; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Haz clic en el siguiente enlace para verificar tu email:
              </p>
              <div style="margin-bottom: 32px;">
                <a href="${finalUrl}" style="display: inline-block; background: #141414; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px;">
                  Verificar Email
                </a>
              </div>
              <p style="color: #a3a3a3; font-size: 14px; line-height: 1.5; margin: 0;">
                Si no creaste una cuenta en <strong style="font-weight: 600;">the stack</strong>, puedes ignorar este correo.
              </p>
            </div>
          `,
        });
      },
    },

    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser: (profile) => ({
          username: profile.login,
        }),
      },
    },

    accountLinking: {
      enabled: true,
      trustedProviders: ['github'],
    },

    user: {
      additionalFields: {
        username: {
          type: 'string',
          required: true,
        },
        karma: {
          type: 'number',
          defaultValue: 0,
          input: false,
        },
        about: {
          type: 'string',
          required: false,
        },
        isAdmin: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        isBanned: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: false,
      },
    },

    trustedOrigins: ['http://localhost:5173', 'https://thestack.cl'],
  });
};

export type Auth = ReturnType<typeof createAuth>;
