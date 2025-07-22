import {
  FileArchive,
  FileAudio,
  FileCode,
  File as FileIcon,
  FileImage,
  FilePieChart,
  FileText,
  FileVideo,
} from "lucide-react";

interface GetFileTypeIconProps {
  file?: File;
  fileName?: string;
}

export const getFileTypeIcon = ({ file, fileName }: GetFileTypeIconProps) => {
  const mimeType = file?.type?.toLowerCase() || "";

  // Video files
  if (mimeType.startsWith("video/")) {
    return FileVideo;
  }

  // Audio files
  if (mimeType.startsWith("audio/")) {
    return FileAudio;
  }

  // Image files
  if (mimeType.startsWith("image/")) {
    return FileImage;
  }

  // Text and document files
  if (mimeType.startsWith("text/") || mimeType === "application/rtf") {
    return FileText;
  }

  // Code files
  if (
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "text/javascript" ||
    mimeType === "text/typescript" ||
    mimeType === "text/css" ||
    mimeType === "text/html" ||
    mimeType === "application/xml" ||
    mimeType === "text/xml"
  ) {
    return FileCode;
  }

  // Office documents
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return FileText;
  }

  // Spreadsheets
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return FilePieChart;
  }

  // Archive files
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-rar-compressed" ||
    mimeType === "application/x-7z-compressed" ||
    mimeType === "application/gzip" ||
    mimeType === "application/x-tar"
  ) {
    return FileArchive;
  }

  // Fallback to file extension if MIME type is not available or recognized
  if (!mimeType && fileName) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "mp4":
      case "mov":
      case "avi":
      case "mkv":
      case "webm":
        return FileVideo;
      case "mp3":
      case "wav":
      case "flac":
      case "aac":
        return FileAudio;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
      case "ico":
      case "heic":
      case "heif":
        return FileImage;
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
      case "css":
      case "html":
      case "json":
      case "xml":
        return FileCode;
      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return FileArchive;
      case "xlsx":
      case "xls":
      case "csv":
        return FilePieChart;
      default:
        return FileIcon;
    }
  }

  // Default fallback
  return FileIcon;
};
