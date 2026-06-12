package tw.dco.mnema;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Completes a task straight from the widget checkbox. Reads the small auth blob
 * the web app stored (project URL + anon key + access token) and POSTs to the
 * Supabase complete_task RPC — the same call the app makes. To feel instant it
 * removes the task from the snapshot and redraws first, then fires the network
 * call in the background; if that fails (e.g. an expired token), the next time
 * the app opens it rewrites the true state and the task reappears.
 */
public class TaskActionReceiver extends BroadcastReceiver {

    public static final String ACTION_COMPLETE = "tw.dco.mnema.COMPLETE_TASK";
    public static final String EXTRA_TASK_ID = "task_id";

    @Override
    public void onReceive(final Context context, Intent intent) {
        if (!ACTION_COMPLETE.equals(intent.getAction())) return;
        final String taskId = intent.getStringExtra(EXTRA_TASK_ID);
        if (taskId == null || taskId.isEmpty()) return;

        SharedPreferences prefs = context.getSharedPreferences(TodayWidget.PREFS, Context.MODE_PRIVATE);
        final String auth = prefs.getString("widget_auth", null);

        // No stored token → can't complete silently; open the app instead.
        if (auth == null) {
            Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (open != null) {
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(open);
            }
            return;
        }

        // Optimistic: drop the task from both snapshots and redraw now.
        removeFromSnapshot(prefs, taskId);
        removeFromCalendarSnapshot(prefs, taskId);
        TodayWidget.refreshAll(context);
        CalendarWidget.refreshAll(context);

        // Network completion off the main thread (goAsync keeps us alive briefly).
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONObject a = new JSONObject(auth);
                    complete(a.optString("url"), a.optString("anonKey"), a.optString("token"), taskId);
                } catch (Exception ignored) {
                    // Best-effort; the next app sync reconciles.
                } finally {
                    pending.finish();
                }
            }
        }).start();
    }

    private static void removeFromSnapshot(SharedPreferences prefs, String taskId) {
        try {
            String raw = prefs.getString(TodayWidget.KEY, null);
            if (raw == null) return;
            JSONObject snap = new JSONObject(raw);
            JSONArray items = snap.optJSONArray("items");
            JSONArray kept = new JSONArray();
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.optJSONObject(i);
                    if (it != null && !taskId.equals(it.optString("id"))) kept.put(it);
                }
            }
            snap.put("items", kept);
            int count = snap.optInt("count", kept.length());
            snap.put("count", Math.max(0, count - 1));
            prefs.edit().putString(TodayWidget.KEY, snap.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Drop the task from every day of the calendar snapshot (it may sit on
     *  both its due and scheduled dates). */
    private static void removeFromCalendarSnapshot(SharedPreferences prefs, String taskId) {
        try {
            String raw = prefs.getString(CalendarWidget.KEY, null);
            if (raw == null) return;
            JSONObject snap = new JSONObject(raw);
            JSONObject days = snap.optJSONObject("days");
            if (days == null) return;
            java.util.Iterator<String> dates = days.keys();
            java.util.List<String> emptied = new java.util.ArrayList<>();
            while (dates.hasNext()) {
                String date = dates.next();
                JSONArray items = days.optJSONArray(date);
                if (items == null) continue;
                JSONArray kept = new JSONArray();
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.optJSONObject(i);
                    if (it != null && !taskId.equals(it.optString("id"))) kept.put(it);
                }
                if (kept.length() == 0) emptied.add(date);
                else days.put(date, kept);
            }
            for (String date : emptied) days.remove(date);
            prefs.edit().putString(CalendarWidget.KEY, snap.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static void complete(String url, String anonKey, String token, String taskId) throws Exception {
        if (url == null || url.isEmpty()) return;
        URL endpoint = new URL(url + "/rest/v1/rpc/complete_task");
        HttpURLConnection c = (HttpURLConnection) endpoint.openConnection();
        try {
            c.setRequestMethod("POST");
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("apikey", anonKey);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Prefer", "return=minimal");

            String body = "{\"p_user_id\":null,\"p_task_id\":\"" + taskId + "\"}";
            OutputStream os = c.getOutputStream();
            os.write(body.getBytes("UTF-8"));
            os.close();

            c.getResponseCode(); // fire the request; nothing to do with the body
        } finally {
            c.disconnect();
        }
    }
}
