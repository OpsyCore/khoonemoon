type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export function getAuthErrorKey(error: unknown) {
  if (typeof error === "string") {
    return normalize(error);
  }

  const e = (error ?? {}) as AuthErrorLike;
  const message = normalize(e.message ?? "");
  const code = normalize(e.code ?? "");

  if (code) return code;
  if (message) return message;
  if (typeof e.status === "number") return `status_${e.status}`;

  return "unknown";
}

export function getPersianAuthErrorMessage(error: unknown) {
  const key = getAuthErrorKey(error);

  if (
    key.includes("email not confirmed") ||
    key === "email_not_confirmed" ||
    key === "email_not_confirmed"
  ) {
    return "ایمیل شما هنوز تایید نشده است. لطفاً ایمیل تایید را بررسی کنید.";
  }

  if (
    key.includes("invalid login credentials") ||
    key === "invalid_credentials"
  ) {
    return "ایمیل یا رمز عبور نادرست است.";
  }

  if (
    key.includes("already registered") ||
    key.includes("already been registered") ||
    key === "user_already_exists"
  ) {
    return "این ایمیل قبلاً ثبت شده است. لطفاً وارد شوید.";
  }

  if (
    key.includes("password should be at least") ||
    key.includes("weak password")
  ) {
    return "رمز عبور کوتاه است. حداقل ۸ کاراکتر وارد کنید.";
  }

  if (
    key.includes("rate limit") ||
    key.includes("too many requests") ||
    key === "status_429"
  ) {
    return "تعداد درخواست‌ها زیاد است. لطفاً چند دقیقه بعد دوباره تلاش کنید.";
  }

  if (
    key.includes("expired") ||
    key.includes("invalid grant") ||
    key.includes("otp_expired") ||
    key.includes("auth_callback_expired_or_invalid")
  ) {
    return "لینک احراز هویت نامعتبر یا منقضی شده است. لطفاً دوباره اقدام کنید.";
  }

  if (key.includes("invalid email") || key.includes("email address")) {
    return "ایمیل وارد شده معتبر نیست.";
  }

  if (key.includes("auth_callback_missing_code")) {
    return "لینک ورود ناقص است. لطفاً دوباره از ایمیل اقدام کنید.";
  }

  if (key.includes("auth_callback_failed")) {
    return "ورود از طریق لینک انجام نشد. لطفاً دوباره تلاش کنید.";
  }

  return "عملیات احراز هویت انجام نشد. لطفاً دوباره تلاش کنید.";
}

export function getAuthCallbackErrorCode(error: unknown) {
  const key = getAuthErrorKey(error);

  if (
    key.includes("expired") ||
    key.includes("invalid") ||
    key.includes("grant") ||
    key.includes("otp")
  ) {
    return "auth_callback_expired_or_invalid";
  }

  return "auth_callback_failed";
}
