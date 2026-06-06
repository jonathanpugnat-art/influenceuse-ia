import { CalendarAgentPanelWrapper } from "./agent-panel-wrapper";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CalendarAgentPanelWrapper>{children}</CalendarAgentPanelWrapper>;
}
