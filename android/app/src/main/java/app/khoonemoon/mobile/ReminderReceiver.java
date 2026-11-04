package app.khoonemoon.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action=intent.getAction();
        if ("app.khoonemoon.mobile.REMINDER".equals(action)) ReminderScheduler.fire(context);
    }
}
