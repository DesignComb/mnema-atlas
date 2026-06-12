package tw.dco.mnema;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Dark "today" widget: today's open tasks, each with a tap-to-complete checkbox,
 * plus a quick-add "+". It reads the snapshot the web app wrote via
 * @capacitor/preferences (SharedPreferences "CapacitorStorage", key
 * "widget_today"); checkbox taps go to TaskActionReceiver, which completes the
 * task live against Supabase. Refreshes on Android's ~30-min cycle and whenever
 * the web app calls WidgetBridge.refresh().
 */
public class TodayWidget extends AppWidgetProvider {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_today";

    private static final int[] ROW_IDS = { R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4 };
    private static final int[] TITLE_IDS = { R.id.title0, R.id.title1, R.id.title2, R.id.title3, R.id.title4 };
    private static final int[] CHECK_IDS = { R.id.check0, R.id.check1, R.id.check2, R.id.check3, R.id.check4 };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    /** Called by WidgetBridge / TaskActionReceiver so a fresh snapshot shows immediately. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName cn = new ComponentName(context, TodayWidget.class);
        for (int id : manager.getAppWidgetIds(cn)) {
            updateWidget(context, manager, id);
        }
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        // A6: follow the app language (widget_lang in Preferences; missing → zh).
        boolean zh = WidgetLang.isZh(context);
        views.setTextViewText(R.id.widget_title, zh ? "今天" : "Today");
        views.setContentDescription(R.id.widget_add, zh ? "新增" : "Add");

        // Tap the card body → open the app.
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(R.id.widget_root,
                PendingIntent.getActivity(context, appWidgetId * 16, open, flags()));
        }

        // Quick-add "+": deep link the app to the Tempo add screen.
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("tw.dco.mnema://add"));
        add.setPackage(context.getPackageName());
        add.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.widget_add,
            PendingIntent.getActivity(context, appWidgetId * 16 + 15, add, flags()));

        int shown = 0;
        int count = 0;
        boolean hasSnapshot = false;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                hasSnapshot = true;
                JSONObject snap = new JSONObject(raw);
                count = snap.optInt("count", 0);
                JSONArray items = snap.optJSONArray("items");
                if (items != null) {
                    int n = Math.min(items.length(), ROW_IDS.length);
                    for (int i = 0; i < n; i++) {
                        JSONObject it = items.optJSONObject(i);
                        if (it == null) continue;
                        String id = it.optString("id", "");
                        String title = it.optString("title", "");
                        String sub = it.optString("sub", "");
                        // The web side sends sub already localized ("逾期"/"Overdue",
                        // "今天"/"Today") — detect the semantic value, don't change the wire.
                        boolean overdue = "逾期".equals(sub) || "Overdue".equals(sub);
                        String text = overdue ? "⚠ " + title : title;

                        views.setTextViewText(TITLE_IDS[i], text);
                        views.setContentDescription(CHECK_IDS[i], zh ? "完成" : "Complete");
                        views.setViewVisibility(ROW_IDS[i], View.VISIBLE);

                        // Checkbox → complete this task live.
                        Intent done = new Intent(context, TaskActionReceiver.class);
                        done.setAction(TaskActionReceiver.ACTION_COMPLETE);
                        done.putExtra(TaskActionReceiver.EXTRA_TASK_ID, id);
                        PendingIntent pi = PendingIntent.getBroadcast(
                            context, appWidgetId * 16 + i, done, flags());
                        views.setOnClickPendingIntent(CHECK_IDS[i], pi);

                        shown++;
                    }
                }
            }
        } catch (Exception e) {
            // Bad/missing snapshot — fall through to the empty state.
        }

        for (int i = shown; i < ROW_IDS.length; i++) {
            views.setViewVisibility(ROW_IDS[i], View.GONE);
        }

        if (!hasSnapshot) {
            views.setTextViewText(R.id.widget_count, "");
            views.setTextViewText(R.id.widget_empty, zh ? "開啟 Mnema 以同步今日待辦" : "Open Mnema to sync today's tasks");
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        } else if (count == 0) {
            views.setTextViewText(R.id.widget_count, "");
            views.setTextViewText(R.id.widget_empty, zh ? "今天沒有待辦 🎉" : "All clear today 🎉");
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        } else {
            views.setTextViewText(R.id.widget_count, zh ? count + " 件" : count + (count == 1 ? " task" : " tasks"));
            views.setViewVisibility(R.id.widget_empty, View.GONE);
        }

        int more = count - shown;
        if (more > 0) {
            views.setTextViewText(R.id.widget_more, zh ? "還有 " + more + " 件…" : "+" + more + " more…");
            views.setViewVisibility(R.id.widget_more, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_more, View.GONE);
        }

        manager.updateAppWidget(appWidgetId, views);
    }
}
