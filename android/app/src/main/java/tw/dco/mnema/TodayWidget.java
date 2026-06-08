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
 * Home-screen widget showing today's open tasks. It reads the snapshot the web
 * app wrote via @capacitor/preferences (SharedPreferences "CapacitorStorage",
 * key "widget_today") — so it needs no network and no auth of its own. Tapping
 * it opens the app. Refreshes on Android's ~30-min cycle and whenever the web
 * app calls WidgetBridge.refresh().
 */
public class TodayWidget extends AppWidgetProvider {

    // Must match @capacitor/preferences' default store name + the WIDGET_TODAY_KEY in src/lib/widget.ts.
    private static final String PREFS = "CapacitorStorage";
    private static final String KEY = "widget_today";

    private static final int[] ROW_IDS = {
        R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    /** Called by WidgetBridge so a fresh snapshot shows immediately. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName cn = new ComponentName(context, TodayWidget.class);
        int[] ids = manager.getAppWidgetIds(cn);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        // Tap anywhere → open the app.
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

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
                        String title = it.optString("title", "");
                        String sub = it.optString("sub", "");
                        String prefix = "逾期".equals(sub) ? "⚠ " : "• ";
                        views.setTextViewText(ROW_IDS[i], prefix + title);
                        views.setViewVisibility(ROW_IDS[i], View.VISIBLE);
                        shown++;
                    }
                }
            }
        } catch (Exception e) {
            // Bad/missing snapshot — fall through to the empty state.
        }

        // Hide unused rows.
        for (int i = shown; i < ROW_IDS.length; i++) {
            views.setViewVisibility(ROW_IDS[i], View.GONE);
        }

        // Count line + empty state.
        if (!hasSnapshot) {
            views.setTextViewText(R.id.widget_count, "");
            views.setTextViewText(R.id.widget_empty, "開啟 Mnema 以同步今日待辦");
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        } else if (count == 0) {
            views.setTextViewText(R.id.widget_count, "");
            views.setTextViewText(R.id.widget_empty, "今天沒有待辦 🎉");
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        } else {
            views.setTextViewText(R.id.widget_count, count + " 件");
            views.setViewVisibility(R.id.widget_empty, View.GONE);
        }

        // "還有 N 件…" footer when there are more than we showed.
        int more = count - shown;
        if (more > 0) {
            views.setTextViewText(R.id.widget_more, "還有 " + more + " 件…");
            views.setViewVisibility(R.id.widget_more, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_more, View.GONE);
        }

        manager.updateAppWidget(appWidgetId, views);
    }
}
