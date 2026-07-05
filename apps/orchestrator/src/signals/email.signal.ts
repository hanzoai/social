import { defineSignal } from '@hanzoai/tasks';

export type Email = {
  message: string;
  title?: string;
  type: 'success' | 'fail' | 'info';
};

export const emailSignal = defineSignal<[Email[]]>('email');
