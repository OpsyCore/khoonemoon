package app.khoonemoon.mobile;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Schedules only already-synced timestamps; stores neither credentials nor titles. */
final class ReminderScheduler {
    private static final String PREFS = "local_reminders";
    private static final String CHANNEL = "reminders";
    private static final int REQUEST = 7124;
    private ReminderScheduler() {}

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static PendingIntent alarmIntent(Context c) {
        return PendingIntent.getBroadcast(c, REQUEST, new Intent(c, ReminderReceiver.class).setAction("app.khoonemoon.mobile.REMINDER"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static synchronized boolean activate(Context context, String account) {
        if (account == null || !account.matches("[0-9a-fA-F-]{36}")) return false;
        if (!account.equals(prefs(context).getString("account", ""))) {
            clear(context);
            prefs(context).edit().putString("account", account).apply();
        }
        return true;
    }
    static synchronized boolean replace(Context context, String account, String raw) {
        if (account == null || !account.matches("[0-9a-fA-F-]{36}") || raw == null || raw.length() > 500000) return false;
        try {
            JSONArray incoming = new JSONArray(raw);
            if (incoming.length() > 10000) return false;
            long now = System.currentTimeMillis();
            JSONArray valid = new JSONArray();
            for (int i=0; i<incoming.length(); i++) {
                JSONObject entry = incoming.getJSONObject(i);
                String id = entry.getString("id"); long at = entry.getLong("at");
                if (!id.matches("[0-9a-fA-F-]{36}") || at <= 0) return false;
                if (at > now) valid.put(new JSONObject().put("id",id).put("at",at));
            }
            SharedPreferences p = prefs(context);
            if (!account.equals(p.getString("account", ""))) clear(context);
            p.edit().putString("account",account).putString("pending",valid.toString()).apply();
            schedule(context);
            return true;
        } catch (JSONException e) { return false; }
    }
    static synchronized void clear(Context context) {
        ((AlarmManager)context.getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent(context));
        prefs(context).edit().clear().apply();
        ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(REQUEST);
    }
    static synchronized void schedule(Context context) {
        AlarmManager alarms = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        alarms.cancel(alarmIntent(context));
        try {
            JSONArray rows = new JSONArray(prefs(context).getString("pending","[]"));
            long earliest = Long.MAX_VALUE;
            for (int i=0; i<rows.length(); i++) earliest=Math.min(earliest,rows.getJSONObject(i).getLong("at"));
            if (earliest != Long.MAX_VALUE) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, Math.max(earliest,System.currentTimeMillis()+1000), alarmIntent(context));
        } catch (JSONException ignored) { clear(context); }
    }
    static synchronized void fire(Context context) {
        try {
            JSONArray rows = new JSONArray(prefs(context).getString("pending","[]"));
            JSONArray remaining = new JSONArray(); long now=System.currentTimeMillis(); int due=0;
            for (int i=0;i<rows.length();i++) {
                JSONObject row=rows.getJSONObject(i);
                if (row.getLong("at") <= now + 1000) due++; else remaining.put(row);
            }
            prefs(context).edit().putString("pending",remaining.toString()).apply();
            if (due>0) show(context, due);
            schedule(context);
        } catch (JSONException ignored) { clear(context); }
    }
    private static void show(Context context,int count) {
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL,"یادآورهای خونه‌مون",NotificationManager.IMPORTANCE_DEFAULT));
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Intent open=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content=PendingIntent.getActivity(context,0,open,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context,CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle("یادآور خونه‌مون")
            .setContentText(count > 1 ? "چند یادآور سررسیده‌اند؛ برنامه را باز کنید." : "یک یادآور سررسیده است؛ برنامه را باز کنید.")
            .setContentIntent(content).setAutoCancel(true);
        manager.notify(REQUEST,builder.build());
    }
}
