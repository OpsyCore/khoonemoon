package app.khoonemoon.mobile;

import java.util.Calendar;
import java.util.TimeZone;

/** Quiet hours are interpreted in the device's current local time zone. */
final class QuietHours {
    private QuietHours() {}

    private static int minutes(String value) {
        if (value == null || !value.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) return -1;
        return Integer.parseInt(value.substring(0, 2)) * 60 + Integer.parseInt(value.substring(3, 5));
    }

    static long lateDelivery(long now, boolean enabled, String startText, String endText, TimeZone zone) {
        return Math.max(now + 2000, adjust(now, enabled, startText, endText, zone));
    }

    static long adjust(long at, boolean enabled, String startText, String endText, TimeZone zone) {
        if (!enabled || at <= 0 || zone == null) return at;
        int start = minutes(startText), end = minutes(endText);
        if (start < 0 || end < 0 || start == end) return at;
        Calendar local = Calendar.getInstance(zone);
        local.setTimeInMillis(at);
        int current = local.get(Calendar.HOUR_OF_DAY) * 60 + local.get(Calendar.MINUTE);
        boolean quiet = start < end ? current >= start && current < end : current >= start || current < end;
        if (!quiet) return at;
        if (start > end && current >= start) local.add(Calendar.DAY_OF_MONTH, 1);
        local.set(Calendar.HOUR_OF_DAY, end / 60);
        local.set(Calendar.MINUTE, end % 60);
        local.set(Calendar.SECOND, 0);
        local.set(Calendar.MILLISECOND, 0);
        return local.getTimeInMillis();
    }
}
