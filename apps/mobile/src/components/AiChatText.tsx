import { LiveChatMarkdown } from "../recording/LiveChatMarkdown";

type Props = {
  content: string;
  onSeek?: (seconds: number) => void;
};

export function AiChatText({ content, onSeek }: Props) {
  return <LiveChatMarkdown content={content} onSeek={onSeek} />;
}
