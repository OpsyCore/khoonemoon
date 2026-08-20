export function statusTone(
  status: string,
): "neutral" | "info" | "success" | "danger" {
  switch (status) {
    case "IN_PROGRESS":
      return "info";
    case "COMPLETED":
    case "DONE":
      return "success";
    case "CANCELLED":
      return "danger";
    case "TODO":
    default:
      return "neutral";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "TODO":
      return "در انتظار";
    case "IN_PROGRESS":
      return "در حال انجام";
    case "COMPLETED":
    case "DONE":
      return "تکمیل‌شده";
    case "CANCELLED":
      return "رد شده";
    default:
      return status;
  }
}

export function priorityTone(
  priority: string,
): "neutral" | "info" | "warning" | "danger" {
  switch (priority) {
    case "LOW":
      return "neutral";
    case "MEDIUM":
      return "info";
    case "HIGH":
      return "warning";
    case "URGENT":
      return "danger";
    default:
      return "neutral";
  }
}

export function priorityLabel(priority: string): string {
  switch (priority) {
    case "LOW":
      return "کم";
    case "MEDIUM":
      return "عادی";
    case "HIGH":
      return "زیاد";
    case "URGENT":
      return "بحرانی";
    default:
      return priority;
  }
}
