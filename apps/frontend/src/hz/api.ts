// Hanzo Social — browser API client. Talks ONLY to the same-origin BFF
// (/hz/bff/*), which attaches the bearer server-side and proxies to the unified
// cloud /v1/*. Pure functions returning typed data; the ONE seam the hooks and
// (later) the extracted @hanzo/ui components fetch through. No token ever
// touches this layer.

import type {
  Post,
  PostInput,
  Campaign,
  CampaignInput,
  ProviderCapability,
  SocialSummary,
  MarketingSummary,
} from './types';

const BFF = '/hz/bff';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BFF}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

// ---- social ----

export const getSocialSummary = () => req<SocialSummary>('/social/summary');

export const listProviders = () =>
  req<{ data: ProviderCapability[] }>('/social/providers').then((r) => r.data);

export const listPosts = (status?: string) =>
  req<{ data: Post[] }>(
    `/social/posts${status ? `?status=${encodeURIComponent(status)}` : ''}`
  ).then((r) => r.data);

export const createPost = (input: PostInput) =>
  req<Post>('/social/posts', { method: 'POST', body: JSON.stringify(input) });

export const updatePost = (id: string, input: PostInput) =>
  req<Post>(`/social/posts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const deletePost = (id: string) =>
  req<null>(`/social/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- marketing ----

export const getMarketingSummary = () =>
  req<MarketingSummary>('/marketing/summary');

export const listCampaigns = () =>
  req<{ data: Campaign[] }>('/marketing/campaigns').then((r) => r.data);

export const createCampaign = (input: CampaignInput) =>
  req<Campaign>('/marketing/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
