import { FileTransfer } from "@/store/main";
import { CheckCircle, Download } from "lucide-react";
import { formatDate } from "./formatDate";

export const getStatusInfo = (transfer: FileTransfer) => {
  const timeText = formatDate(transfer.lastStatusChange);
  const direction = transfer.isOwn ? "Sent" : "Received";

  switch (transfer.status) {
    case "queued":
      return { text: "Queued...", color: "fg.muted", icon: null };
    case "sending":
      return { text: "Sending...", color: "blue.solid", icon: null };
    case "sent":
      return {
        text: `Sent ${timeText}`,
        color: "green.solid",
        icon: CheckCircle,
      };
    case "receiving":
      return { text: "Receiving...", color: "blue.solid", icon: null };
    case "received":
      return {
        text: `Received ${timeText}`,
        color: "orange.solid",
        icon: Download,
      };
    case "downloaded-by-peer":
      return {
        text: `Downloaded ${timeText}`,
        color: "green.solid",
        icon: CheckCircle,
      };
    case "downloaded-by-you":
      return {
        text: `Downloaded ${timeText}`,
        color: "green.solid",
        icon: CheckCircle,
      };
    default:
      return {
        text: `${direction} ${timeText}`,
        color: "fg.muted",
        icon: null,
      };
  }
};
