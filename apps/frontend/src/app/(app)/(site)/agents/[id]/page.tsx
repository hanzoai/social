import { Metadata } from 'next';
import { Agent } from '@social/frontend/components/agents/agent';
import { AgentChat } from '@social/frontend/components/agents/agent.chat';
export const metadata: Metadata = {
  title: 'Hanzo Social - Agent',
  description: '',
};
export default async function Page() {
  return (
    <AgentChat />
  );
}
