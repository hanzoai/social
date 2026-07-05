import {
  defineSearchAttributeKey,
  SearchAttributeType,
} from '@hanzoai/tasks';

export const organizationId = defineSearchAttributeKey(
  'organizationId',
  SearchAttributeType.TEXT
);

export const postId = defineSearchAttributeKey(
  'postId',
  SearchAttributeType.TEXT
);
