package tw.dco.mnema;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Toggles a habit's check-in from the widget. Calls the reset-aware
 * toggle_check_in RPC (migration 0036), which flips based on the SERVER's own
 * habit-day and returns the new state — so a stale snapshot (e.g. after a day
 * rollover with the app closed) can never act on the wrong day. We flip
 * optimistically for instant feedback, then correct to the authoritative result.
 */
public class HabitActionReceiver extends BroadcastReceiver {

  public static final String ACTION_TOGGLE = "tw.dco.mnema.TOGGLE_HABIT";
  public static final String EXTRA_HABIT_ID = "habit_id";
  public static final String EXTRA_CHECKED = "checked";

  @Override
  public void onReceive(final Context context, Intent intent) {
    if (!ACTION_TOGGLE.equals(intent.getAction())) return;
    final String habitId = intent.getStringExtra(EXTRA_HABIT_ID);
    final boolean wasChecked = intent.getBooleanExtra(EXTRA_CHECKED, false);
    if (habitId == null || habitId.isEmpty()) return;

    final SharedPreferences prefs = context.getSharedPreferences(HabitsWidget.PREFS, Context.MODE_PRIVATE);
    final String auth = prefs.getString("widget_auth", null);
    if (auth == null) {
      Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      if (open != null) {
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(open);
      }
      return;
    }

    // Optimistic flip for instant feedback (corrected below by the server's answer).
    flipSnapshot(prefs, habitId, !wasChecked);
    flipStreakSnapshot(prefs, habitId, !wasChecked);
    HabitsWidget.refreshAll(context);
    StreakWidget.refreshAll(context);

    final PendingResult pending = goAsync();
    new Thread(new Runnable() {
      @Override
      public void run() {
        try {
          JSONObject a = new JSONObject(auth);
          Boolean nowChecked = toggle(a.optString("url"), a.optString("anonKey"), a.optString("token"), habitId);
          if (nowChecked != null) {
            flipSnapshot(prefs, habitId, nowChecked); // authoritative server state
            flipStreakSnapshot(prefs, habitId, nowChecked);
            HabitsWidget.refreshAll(context);
            StreakWidget.refreshAll(context);
          }
        } catch (Exception ignored) {
        } finally {
          pending.finish();
        }
      }
    }).start();
  }

  private static void flipSnapshot(SharedPreferences prefs, String habitId, boolean checked) {
    try {
      String raw = prefs.getString(HabitsWidget.KEY, null);
      if (raw == null) return;
      JSONObject snap = new JSONObject(raw);
      JSONArray items = snap.optJSONArray("items");
      if (items == null) return;
      for (int i = 0; i < items.length(); i++) {
        JSONObject it = items.optJSONObject(i);
        if (it != null && habitId.equals(it.optString("id"))) it.put("checked", checked);
      }
      prefs.edit().putString(HabitsWidget.KEY, snap.toString()).apply();
    } catch (Exception ignored) {
    }
  }

  /**
   * Keep the Streak widget in agreement when its featured habit is the one
   * toggled — otherwise it contradicts the Habits widget until the app opens.
   */
  private static void flipStreakSnapshot(SharedPreferences prefs, String habitId, boolean checked) {
    try {
      String raw = prefs.getString(StreakWidget.KEY, null);
      if (raw == null) return;
      JSONObject snap = new JSONObject(raw);
      if (!habitId.equals(snap.optString("habit_id"))) return;
      snap.put("checked_today", checked);
      JSONArray days = snap.optJSONArray("days");
      if (days != null && days.length() > 0) {
        JSONObject last = days.optJSONObject(days.length() - 1);
        if (last != null) last.put("c", checked);
      }
      // The streak count itself needs the server's recompute — the app's next
      // sync corrects it; checked-state agreement is what matters offline.
      prefs.edit().putString(StreakWidget.KEY, snap.toString()).apply();
    } catch (Exception ignored) {
    }
  }

  /** POST toggle_check_in; returns the new checked state (true/false), or null on failure. */
  private static Boolean toggle(String url, String anonKey, String token, String taskId) throws Exception {
    if (url == null || url.isEmpty()) return null;
    URL endpoint = new URL(url + "/rest/v1/rpc/toggle_check_in");
    HttpURLConnection c = (HttpURLConnection) endpoint.openConnection();
    try {
      c.setRequestMethod("POST");
      c.setConnectTimeout(8000);
      c.setReadTimeout(8000);
      c.setDoOutput(true);
      c.setRequestProperty("Content-Type", "application/json");
      c.setRequestProperty("apikey", anonKey);
      c.setRequestProperty("Authorization", "Bearer " + token);
      String body = "{\"p_user_id\":null,\"p_task_id\":\"" + taskId + "\"}";
      OutputStream os = c.getOutputStream();
      os.write(body.getBytes("UTF-8"));
      os.close();
      int code = c.getResponseCode();
      if (code < 200 || code >= 300) return null;
      InputStream is = c.getInputStream();
      ByteArrayOutputStream buf = new ByteArrayOutputStream();
      byte[] tmp = new byte[256];
      int n;
      while ((n = is.read(tmp)) != -1) buf.write(tmp, 0, n);
      is.close();
      return Boolean.valueOf("true".equalsIgnoreCase(buf.toString("UTF-8").trim()));
    } finally {
      c.disconnect();
    }
  }
}
