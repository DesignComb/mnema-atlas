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
 * Toggles a habit's check-in straight from the widget. Reads the stored auth blob
 * (project URL + anon key + access token) and POSTs the Supabase check_in /
 * uncheck_in RPC with NO date, so the server computes the reset-aware habit-day
 * (migration 0033). Optimistic: flips the snapshot + redraws first, then the
 * network call; the next app sync reconciles if it fails.
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

    SharedPreferences prefs = context.getSharedPreferences(HabitsWidget.PREFS, Context.MODE_PRIVATE);
    final String auth = prefs.getString("widget_auth", null);
    if (auth == null) {
      Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      if (open != null) {
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(open);
      }
      return;
    }

    // Optimistic flip + redraw.
    flipSnapshot(prefs, habitId, !wasChecked);
    HabitsWidget.refreshAll(context);

    final PendingResult pending = goAsync();
    new Thread(new Runnable() {
      @Override
      public void run() {
        try {
          JSONObject a = new JSONObject(auth);
          // wasChecked → undo it; else check in. Both reset-aware (no date).
          String rpc = wasChecked ? "uncheck_in" : "check_in";
          call(a.optString("url"), a.optString("anonKey"), a.optString("token"), rpc, habitId);
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

  private static void call(String url, String anonKey, String token, String rpc, String taskId) throws Exception {
    if (url == null || url.isEmpty()) return;
    URL endpoint = new URL(url + "/rest/v1/rpc/" + rpc);
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
      c.getResponseCode();
    } finally {
      c.disconnect();
    }
  }
}
