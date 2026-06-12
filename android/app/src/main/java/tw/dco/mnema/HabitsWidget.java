package tw.dco.mnema;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Dark habit widget: today's habits, each with a tap-to-check-in circle. Reads
 * the snapshot the web app wrote (SharedPreferences "CapacitorStorage", key
 * "widget_habits"); a tap goes to HabitActionReceiver, which toggles the check-in
 * live against Supabase (reset-aware — check_in computes the habit-day server-side
 * per migration 0033). Refreshes on the ~30-min cycle and via WidgetBridge.
 */
public class HabitsWidget extends AppWidgetProvider {

  static final String PREFS = "CapacitorStorage";
  static final String KEY = "widget_habits";

  private static final int[] ROW_IDS = { R.id.hrow0, R.id.hrow1, R.id.hrow2, R.id.hrow3, R.id.hrow4, R.id.hrow5 };
  private static final int[] CHECK_IDS = { R.id.hcheck0, R.id.hcheck1, R.id.hcheck2, R.id.hcheck3, R.id.hcheck4, R.id.hcheck5 };
  private static final int[] TITLE_IDS = { R.id.htitle0, R.id.htitle1, R.id.htitle2, R.id.htitle3, R.id.htitle4, R.id.htitle5 };

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int id : appWidgetIds) updateWidget(context, manager, id);
  }

  public static void refreshAll(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    for (int id : manager.getAppWidgetIds(new ComponentName(context, HabitsWidget.class))) {
      updateWidget(context, manager, id);
    }
  }

  private static int flags() {
    return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
  }

  private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.habits_widget);

    // A6: follow the app language (widget_lang in Preferences; missing → zh).
    boolean zh = WidgetLang.isZh(context);
    views.setTextViewText(R.id.habits_title, zh ? "習慣" : "Habits");

    Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (open != null) {
      open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      views.setOnClickPendingIntent(R.id.habits_root, PendingIntent.getActivity(context, appWidgetId * 16, open, flags()));
    }

    int shown = 0;
    int doneCount = 0;
    boolean hasSnapshot = false;

    try {
      SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      String raw = prefs.getString(KEY, null);
      if (raw != null) {
        hasSnapshot = true;
        JSONArray items = new JSONObject(raw).optJSONArray("items");
        if (items != null) {
          int n = Math.min(items.length(), ROW_IDS.length);
          for (int i = 0; i < n; i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            String id = it.optString("id", "");
            String title = it.optString("title", "");
            boolean checked = it.optBoolean("checked", false);
            if (checked) doneCount++;

            views.setTextViewText(TITLE_IDS[i], title);
            views.setImageViewResource(CHECK_IDS[i], checked ? R.drawable.ic_widget_check_filled : R.drawable.ic_widget_check);
            views.setContentDescription(CHECK_IDS[i], zh ? "打卡" : "Check in");
            views.setViewVisibility(ROW_IDS[i], View.VISIBLE);

            Intent toggle = new Intent(context, HabitActionReceiver.class);
            toggle.setAction(HabitActionReceiver.ACTION_TOGGLE);
            toggle.putExtra(HabitActionReceiver.EXTRA_HABIT_ID, id);
            toggle.putExtra(HabitActionReceiver.EXTRA_CHECKED, checked);
            views.setOnClickPendingIntent(CHECK_IDS[i], PendingIntent.getBroadcast(context, appWidgetId * 16 + i, toggle, flags()));

            shown++;
          }
        }
      }
    } catch (Exception e) {
      // fall through to empty state
    }

    for (int i = shown; i < ROW_IDS.length; i++) {
      views.setViewVisibility(ROW_IDS[i], View.GONE);
    }

    if (!hasSnapshot) {
      views.setTextViewText(R.id.habits_count, "");
      views.setTextViewText(R.id.habits_empty, zh ? "開啟 Mnema 以同步習慣" : "Open Mnema to sync habits");
      views.setViewVisibility(R.id.habits_empty, View.VISIBLE);
    } else if (shown == 0) {
      views.setTextViewText(R.id.habits_count, "");
      views.setTextViewText(R.id.habits_empty, zh ? "還沒有習慣" : "No habits yet");
      views.setViewVisibility(R.id.habits_empty, View.VISIBLE);
    } else {
      views.setTextViewText(R.id.habits_count, doneCount + "/" + shown);
      views.setViewVisibility(R.id.habits_empty, View.GONE);
    }

    manager.updateAppWidget(appWidgetId, views);
  }
}
