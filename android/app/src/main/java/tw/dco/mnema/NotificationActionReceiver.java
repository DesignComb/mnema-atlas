package tw.dco.mnema;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Handles the 延後/已完成 buttons on a reminder notification (and stores a rotated
 * FCM token). Reuses the same stored auth blob the widgets use ("widget_auth" in
 * CapacitorStorage) to call the Supabase RPC directly — no app launch needed.
 */
public class NotificationActionReceiver extends BroadcastReceiver {

  public static final String ACTION = "tw.dco.mnema.NOTIF_ACTION";

  @Override
  public void onReceive(final Context context, Intent intent) {
    if (!ACTION.equals(intent.getAction())) return;
    final String act = intent.getStringExtra("act");
    final String taskId = intent.getStringExtra("task_id");
    final String reminderId = intent.getStringExtra("reminder_id");
    final int nid = intent.getIntExtra("nid", 0);

    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(nid);

    final SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
    final String auth = prefs.getString("widget_auth", null);
    if (auth == null) {
      Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      if (open != null) {
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(open);
      }
      return;
    }

    final PendingResult pending = goAsync();
    new Thread(new Runnable() {
      @Override
      public void run() {
        try {
          JSONObject a = new JSONObject(auth);
          if ("done".equals(act) && taskId != null) {
            rpc(a, "complete_task", "{\"p_user_id\":null,\"p_task_id\":\"" + taskId + "\"}");
          } else if ("checkin".equals(act) && taskId != null) {
            rpc(a, "check_in", "{\"p_user_id\":null,\"p_task_id\":\"" + taskId + "\"}");
          } else if ("snooze".equals(act) && reminderId != null) {
            rpc(a, "snooze_reminder", "{\"p_user_id\":null,\"p_reminder_id\":\"" + reminderId + "\",\"p_minutes\":60}");
          }
        } catch (Exception ignored) {
        } finally {
          pending.finish();
        }
      }
    }).start();
  }

  /** Store a rotated FCM token if we have the user's auth blob (best-effort). */
  static void saveFcmTokenBestEffort(Context context, final String token) {
    final SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
    final String auth = prefs.getString("widget_auth", null);
    if (auth == null || token == null) return;
    new Thread(new Runnable() {
      @Override
      public void run() {
        try {
          JSONObject a = new JSONObject(auth);
          rpc(a, "save_fcm_token", "{\"p_user_id\":null,\"p_token\":\"" + token + "\",\"p_platform\":\"android\"}");
        } catch (Exception ignored) {
        }
      }
    }).start();
  }

  private static void rpc(JSONObject a, String fn, String body) throws Exception {
    String url = a.optString("url");
    if (url == null || url.isEmpty()) return;
    URL endpoint = new URL(url + "/rest/v1/rpc/" + fn);
    HttpURLConnection c = (HttpURLConnection) endpoint.openConnection();
    try {
      c.setRequestMethod("POST");
      c.setConnectTimeout(8000);
      c.setReadTimeout(8000);
      c.setDoOutput(true);
      c.setRequestProperty("Content-Type", "application/json");
      c.setRequestProperty("apikey", a.optString("anonKey"));
      c.setRequestProperty("Authorization", "Bearer " + a.optString("token"));
      c.setRequestProperty("Prefer", "return=minimal");
      OutputStream os = c.getOutputStream();
      os.write(body.getBytes("UTF-8"));
      os.close();
      c.getResponseCode();
    } finally {
      c.disconnect();
    }
  }
}
