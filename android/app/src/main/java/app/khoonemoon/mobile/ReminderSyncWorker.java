package app.khoonemoon.mobile;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/** Periodically pulls only a revocable device's reminder timestamps; no auth session. */
public final class ReminderSyncWorker extends Worker {
    private static final String WORK = "reminder-background-sync";
    private static final String ENDPOINT = "https://isfzuxrkzeeeggvfcoah.supabase.co/rest/v1/rpc/read_reminder_device";
    private static final String PUBLISHABLE_KEY = "sb_publishable_8K19EQ14TIUDZrVlDvIuyQ_0mVaEkjd";
    public ReminderSyncWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    static void enable(Context context) {
        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(ReminderSyncWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, work);
    }
    static void cancel(Context context) { WorkManager.getInstance(context).cancelUniqueWork(WORK); }
    private static byte[] readBounded(InputStream input) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] bytes = new byte[8192]; int count;
        while ((count = input.read(bytes)) != -1) { if (out.size() + count > 1500000) throw new IllegalStateException("snapshot too large"); out.write(bytes, 0, count); }
        return out.toByteArray();
    }
    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext(); JSONObject credential = BackgroundCredential.get(context);
        if (credential == null) return Result.success();
        String id = credential.optString("id"), account = credential.optString("account"), secret = credential.optString("secret");
        long revision = ReminderScheduler.revision(context);
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection)new URL(ENDPOINT).openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
            connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", PUBLISHABLE_KEY);
            byte[] body = new JSONObject().put("p_id",id).put("p_secret",secret).toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = connection.getOutputStream()) { out.write(body); }
            int code = connection.getResponseCode();
            if (code == 401 || code == 403) return Result.success();
            if (code < 200 || code >= 300) return Result.retry();
            JSONObject snapshot;
            try (InputStream input = connection.getInputStream()) { snapshot = new JSONObject(new String(readBounded(input), StandardCharsets.UTF_8)); }
            JSONArray rows = snapshot.getJSONArray("reminders"); if (rows.length() > 10000) return Result.retry();
            JSONObject preferences = snapshot.optJSONObject("preferences");
            boolean enabled = preferences == null || preferences.optBoolean("enabled", true);
            boolean quiet = preferences != null && preferences.optBoolean("quiet_enabled", false);
            String start = preferences == null ? null : preferences.optString("quiet_start", null);
            String end = preferences == null ? null : preferences.optString("quiet_end", null);
            JSONArray schedule = new JSONArray(); long now = System.currentTimeMillis();
            JSONObject delivered = ReminderScheduler.delivered(context);
            if (enabled) for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i); String reminder = row.getString("id");
                long original = row.getLong("at_ms");
                if (!reminder.matches("[0-9a-fA-F-]{36}") || original <= 0) return Result.retry();
                long at = QuietHours.adjust(original, quiet, start, end, TimeZone.getDefault());
                if (at <= now) {
                    if (now - at > TimeUnit.HOURS.toMillis(24) || delivered.optLong(reminder, -1) == at) continue;
                    long deliverAt = QuietHours.lateDelivery(now, quiet, start, end, TimeZone.getDefault());
                    schedule.put(new JSONObject().put("id",reminder).put("at",deliverAt).put("source",at));
                } else schedule.put(new JSONObject().put("id",reminder).put("at",at).put("source",at));
            }
            synchronized (BackgroundCredential.class) {
                if (!BackgroundCredential.isCurrent(context,id,account) || isStopped()) return Result.success();
                ReminderScheduler.replaceIfUnchanged(context,account,schedule.toString(),revision);
            }
            return Result.success();
        } catch (Exception ignored) { return Result.retry(); }
        finally { if (connection != null) connection.disconnect(); }
    }
}
