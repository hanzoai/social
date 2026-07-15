'use client';

// Hanzo Social — SWR data hooks. This is the injectable data layer: components
// receive data + callbacks via props and never fetch themselves, so the same
// components lift cleanly into @hanzo/ui (Phase B). Mutations revalidate the
// affected keys so the board/summary stay live.

import useSWR, { mutate } from 'swr';
import * as api from './api';
import type { PostInput, CampaignInput } from './types';

const KEYS = {
  summary: '/social/summary',
  providers: '/social/providers',
  posts: '/social/posts',
  campaigns: '/marketing/campaigns',
  marketingSummary: '/marketing/summary',
};

export const useSocialSummary = () =>
  useSWR(KEYS.summary, api.getSocialSummary, { revalidateOnFocus: false });

export const useProviders = () =>
  useSWR(KEYS.providers, api.listProviders, { revalidateOnFocus: false });

// All posts (the board splits them into columns client-side, one fetch).
export const usePosts = () =>
  useSWR(KEYS.posts, () => api.listPosts(), { revalidateOnFocus: false });

export const useCampaigns = () =>
  useSWR(KEYS.campaigns, api.listCampaigns, { revalidateOnFocus: false });

export const useMarketingSummary = () =>
  useSWR(KEYS.marketingSummary, api.getMarketingSummary, {
    revalidateOnFocus: false,
  });

// Revalidate everything a post write can change.
const refreshPosts = () => {
  mutate(KEYS.posts);
  mutate(KEYS.summary);
};

export const postActions = {
  create: async (input: PostInput) => {
    const p = await api.createPost(input);
    refreshPosts();
    return p;
  },
  update: async (id: string, input: PostInput) => {
    const p = await api.updatePost(id, input);
    refreshPosts();
    return p;
  },
  remove: async (id: string) => {
    await api.deletePost(id);
    refreshPosts();
  },
};

export const campaignActions = {
  create: async (input: CampaignInput) => {
    const c = await api.createCampaign(input);
    mutate(KEYS.campaigns);
    mutate(KEYS.marketingSummary);
    return c;
  },
};
