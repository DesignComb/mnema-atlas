package tw.dco.mnema;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Renders FCM data-only pushes ourselves so reminders can carry 延後/已完成 action
 * buttons (a system-rendered FCM "notification" message can't). Replaces the
 * Capacitor plugin's MessagingService (removed in the manifest); the plugin still
 * handles permission + token registration via getToken().
 */
public class MnemaMessagingService extends FirebaseMessagingService {

  private static final String CHANNEL = "mnema_reminders";

  @Override
  public void onMessageReceived(RemoteMessage msg) {
    Map<String, String> d = msg.getData();
    String title = d.get("title");
    String body = d.get("body");
    if (title == null) title = "Mnema";
    if (body == null) body = "";
    String kind = d.get("kind");
    String taskId = d.get("task_id");
    String reminderId = d.get("reminder_id");
    String habitDate = d.get("habit_date");
    int nid = taskId != null ? taskId.hashCode() : (int) System.currentTimeMillis();

    ensureChannel();

    Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (open == null) open = new Intent();
    open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent tapPi = PendingIntent.getActivity(
        this, nid, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(R.drawable.ic_notify)
        .setContentTitle(title)
        .setContentText(body)
        .setAutoCancel(true)
        .setContentIntent(tapPi)
        .setPriority(NotificationCompat.PRIORITY_HIGH);

    if ("reminder".equals(kind) && taskId != null) {
      b.addAction(0, "已完成", actionPi(nid * 31 + 1, "done", taskId, reminderId, habitDate, nid));
      b.addAction(0, "延後 1 小時", actionPi(nid * 31 + 2, "snooze", taskId, reminderId, habitDate, nid));
    } else if ("habit".equals(kind) && taskId != null) {
      b.addAction(0, "打卡", actionPi(nid * 31 + 3, "checkin", taskId, reminderId, habitDate, nid));
    }

    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.notify(nid, b.build());
  }

  private PendingIntent actionPi(int req, String action, String taskId, String reminderId, String habitDate, int nid) {
    Intent i = new Intent(this, NotificationActionReceiver.class);
    i.setAction(NotificationActionReceiver.ACTION);
    i.putExtra("act", action);
    i.putExtra("task_id", taskId);
    i.putExtra("reminder_id", reminderId);
    i.putExtra("habit_date", habitDate);
    i.putExtra("nid", nid);
    return PendingIntent.getBroadcast(this, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "提醒 Reminders", NotificationManager.IMPORTANCE_HIGH));
      }
    }
  }

  @Override
  public void onNewToken(String token) {
    NotificationActionReceiver.saveFcmTokenBestEffort(getApplicationContext(), token);
  }
}
