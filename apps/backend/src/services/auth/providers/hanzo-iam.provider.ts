import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';

// Hanzo IAM OAuth/OIDC provider (RFC 6749 + OIDC 1.0).
//
// Endpoints (per HIP-0026):
//   GET  ${IAM_URL}/oauth/authorize    — authorization code grant
//   POST ${IAM_URL}/oauth/token        — code exchange
//   GET  ${IAM_URL}/oauth/userinfo     — profile (email, sub, owner)
//
// Env wiring (set in universe/infra/k8s/social/configmap.yaml and KMSSecret):
//   IAM_URL           = https://hanzo.id
//   IAM_CLIENT_ID     = hanzo-social
//   IAM_CLIENT_SECRET = <from KMS social-secrets/IAM_CLIENT_SECRET>
//
// The IAM `owner` claim (org slug) is exposed via the userinfo response and
// used by the post-registration hook to federate the Postiz Organization
// from the IAM org (see Task #36).

const IAM_URL = () => process.env.IAM_URL || 'https://hanzo.id';
const REDIRECT_URI = () =>
  `${process.env.FRONTEND_URL}/auth/oauth/hanzo-iam/callback`;

@AuthProvider({ provider: 'HANZO' })
export class HanzoIamProvider extends AuthProviderAbstract {
  generateLink(): string {
    const params = new URLSearchParams({
      client_id: process.env.IAM_CLIENT_ID || 'hanzo-social',
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: REDIRECT_URI(),
    });
    return `${IAM_URL()}/oauth/authorize?${params.toString()}`;
  }

  async getToken(code: string, _redirectUri?: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.IAM_CLIENT_ID || 'hanzo-social',
      client_secret: process.env.IAM_CLIENT_SECRET || '',
      redirect_uri: REDIRECT_URI(),
    });
    const res = await fetch(`${IAM_URL()}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(
        `Hanzo IAM /oauth/token failed: ${res.status} ${res.statusText}`
      );
    }
    const { access_token } = (await res.json()) as { access_token: string };
    return access_token;
  }

  async getUser(
    access_token: string
  ): Promise<{ email: string; id: string } | false> {
    const res = await fetch(`${IAM_URL()}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      preferred_username?: string;
    };
    if (!data.email || !data.sub) return false;
    return { email: data.email, id: String(data.sub) };
  }
}
