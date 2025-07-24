import { FileTransfer } from "@/store/main";
import { CheckCheckIcon } from "lucide-react";
import { formatDate } from "./formatDate";

export const getStatusInfo = (transfer: FileTransfer) => {
  const timeText = formatDate(transfer.lastStatusChange);
  const direction = transfer.isOwn ? "Sent" : "Received";

  switch (transfer.status) {
    case "queued":
      return { text: "Queued...", color: "fg.muted", icon: null };
    case "sending":
      return { text: "Sending...", color: "fg.muted", icon: null };
    case "sent":
      return {
        text: `Sent ${timeText}`,
        color: "fg.muted",
        icon: CheckCheckIcon,
      };
    case "receiving":
      return { text: "Receiving...", color: "fg.muted", icon: null };
    case "received":
      return {
        text: `Received ${timeText}`,
        color: "fg.muted",
        icon: CheckCheckIcon,
      };
    case "downloaded-by-peer":
      return {
        text: `Downloaded ${timeText}`,
        color: "green.solid",
        icon: CheckCheckIcon,
      };
    case "downloaded-by-you":
      return {
        text: `Downloaded ${timeText}`,
        color: "green.solid",
        icon: CheckCheckIcon,
      };
    default:
      return {
        text: `${direction} ${timeText}`,
        color: "fg.muted",
        icon: null,
      };
  }
};
