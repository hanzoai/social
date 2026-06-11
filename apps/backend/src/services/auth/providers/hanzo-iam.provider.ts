import {
  AuthProvider,
  AuthProviderAbstract,
} from '@social/backend/services/auth/providers.interface';
import { OrganizationService } from '@social/nestjs-libraries/database/prisma/organizations/organization.service';

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
// used by the post-registration hook to federate the Hanzo Social Organization
// from the IAM org (see Task #36).

const IAM_URL = () => process.env.IAM_URL || 'https://hanzo.id';
const REDIRECT_URI = () =>
  `${process.env.FRONTEND_URL}/auth/oauth/hanzo-iam/callback`;

@AuthProvider({ provider: 'HANZO' })
export class HanzoIamProvider extends AuthProviderAbstract {
  constructor(private _organizationService: OrganizationService) {
    super();
  }

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
  ): Promise<{ email: string; id: string }> {
    const res = await fetch(`${IAM_URL()}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) {
      throw new Error(`Hanzo IAM /oauth/userinfo failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      preferred_username?: string;
    };
    if (!data.email || !data.sub) {
      throw new Error('Hanzo IAM userinfo missing email or sub claim');
    }
    return { email: data.email, id: String(data.sub) };
  }

  // Federate Hanzo Social Organization from the IAM `owner` claim.
  // After auth.service.ts createOrgAndUser auto-creates a Hanzo Social org for
  // the new user, we rename it to match the IAM org slug so subsequent
  // sign-ins from the same IAM org land in the SAME Hanzo Social organization
  // (lookup by name; team membership grows organically).
  //
  // Note: this is "first writer wins" — if two users from the same IAM
  // org sign up concurrently, both will get their own Hanzo Social org renamed
  // to the IAM slug. The unique-name reconciliation (merge into single
  // org + move memberships) is a separate hardening task.
  async postRegistration(
    providerToken: string,
    orgId: string
  ): Promise<void> {
    try {
      const res = await fetch(`${IAM_URL()}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${providerToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        owner?: string;
        preferred_username?: string;
      };
      const slug = data.owner || data.preferred_username;
      if (slug) {
        await this._organizationService.updateOrgName(orgId, slug);
      }
    } catch {
      // Silent fallback — registration succeeded, just keep the
      // user-supplied company name. auth.service swallows postRegistration
      // errors anyway.
    }
  }
}
