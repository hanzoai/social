'use client'

/**
 * social.hanzo.ai — the dedicated Hanzo Social app.
 *
 * The product is `SocialResource` from @hanzo/ui/product/social, the SAME component
 * the console renders for Publish. This app is the second host of one surface, not a
 * second surface: everything visible lives in the package, and all this file supplies
 * is the transport (src/api.ts) onto the unified cloud backend's /v1/social.
 */
import { SocialResource } from '@hanzo/ui/product/social'

import { SocialApi } from '~/api'

export default function Page() {
  return <SocialResource api={SocialApi} />
}
