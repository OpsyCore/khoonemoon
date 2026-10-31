package app.khoonemoon.mobile;
import java.util.Calendar;
import java.util.TimeZone;

/** Standalone JVM regression tests: no SDK, emulator or APK required. */
public final class QuietHoursTest {
    private static final TimeZone ZONE = TimeZone.getTimeZone("Asia/Tehran");
    private static long at(int day, int hour, int minute) {
        Calendar c = Calendar.getInstance(ZONE);
        c.clear(); c.set(2026, Calendar.JANUARY, day, hour, minute);
        return c.getTimeInMillis();
    }
    private static void check(long expected, long actual) {
        if (expected != actual) throw new AssertionError("Expected " + expected + " but got " + actual);
    }
    public static void main(String[] args) {
        check(at(2,8,0), QuietHours.adjust(at(1,23,30), true,"22:00","08:00",ZONE));
        check(at(1,8,0), QuietHours.adjust(at(1,2,30), true,"22:00","08:00",ZONE));
        check(at(1,17,0), QuietHours.adjust(at(1,14,30), true,"13:00","17:00",ZONE));
        check(at(1,8,0), QuietHours.adjust(at(1,8,0), true,"22:00","08:00",ZONE));
        check(at(1,9,0), QuietHours.adjust(at(1,9,0), true,"22:00","08:00",ZONE));
        check(at(1,23,0), QuietHours.adjust(at(1,23,0), true,"99:99","08:00",ZONE));
        check(at(1,23,0), QuietHours.adjust(at(1,23,0), false,"22:00","08:00",ZONE));
        check(at(1,23,0), QuietHours.adjust(at(1,23,0), true,"22:00","22:00",ZONE));
        System.out.println("QuietHours tests passed");
    }
}
