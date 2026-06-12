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
 * Duolingo-style streak widget for the user's primary habit: 🔥 + current
 * streak, longest streak, a 7×4 dot grid of the last 28 days (oldest top-left,
 * today bottom-right) and a "checked in today?" hint. Reads the snapshot the
 * web app wrote (SharedPreferences "CapacitorStorage", key "widget_streak").
 * Tap → open the app (like the habits widget). Refreshes on the ~30-min cycle
 * and via WidgetBridge. Static 28 cells — no RemoteViewsService.
 */
public class StreakWidget extends AppWidgetProvider {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_streak";

    private static final int COLOR_ACCENT = 0xFFAEC0FF;
    private static final int COLOR_MUTED = 0xFF9A9AA6;

    private static final int[] CELL_IDS = {
        R.id.c0,  R.id.c1,  R.id.c2,  R.id.c3,  R.id.c4,  R.id.c5,  R.id.c6,
        R.id.c7,  R.id.c8,  R.id.c9,  R.id.c10, R.id.c11, R.id.c12, R.id.c13,
        R.id.c14, R.id.c15, R.id.c16, R.id.c17, R.id.c18, R.id.c19, R.id.c20,
        R.id.c21, R.id.c22, R.id.c23, R.id.c24, R.id.c25, R.id.c26, R.id.c27
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateWidget(context, manager, id);
    }

    /** Called by WidgetBridge so a fresh snapshot shows immediately. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, StreakWidget.class))) {
            updateWidget(context, manager, id);
        }
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.streak_widget);

        boolean zh = WidgetLang.isZh(context);

        // Tap anywhere → open the app (habits live on the Tempo screen).
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(R.id.streak_root,
                PendingIntent.getActivity(context, appWidgetId * 16, open, flags()));
        }

        boolean hasSnapshot = false;
        String title = null;
        int streak = 0;
        int longest = 0;
        boolean checkedToday = false;
        JSONArray days = null;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                hasSnapshot = true;
                JSONObject snap = new JSONObject(raw);
                if (!snap.isNull("title")) {
                    String t = snap.optString("title", "");
                    if (!t.isEmpty()) title = t;
                }
                streak = snap.optInt("streak", 0);
                longest = snap.optInt("longest", 0);
                checkedToday = snap.optBoolean("checked_today", false);
                days = snap.optJSONArray("days");
            }
        } catch (Exception e) {
            // Bad/missing snapshot — fall through to the empty state.
        }

        if (title == null) {
            // No habit yet (or no snapshot at all) — collapse to a single hint line.
            views.setViewVisibility(R.id.streak_top, View.GONE);
            views.setViewVisibility(R.id.streak_grid, View.GONE);
            views.setViewVisibility(R.id.streak_hint, View.GONE);
            views.setTextViewText(R.id.streak_empty, hasSnapshot
                ? (zh ? "還沒有習慣" : "No habits yet")
                : (zh ? "開啟 Mnema 以同步習慣" : "Open Mnema to sync habits"));
            views.setViewVisibility(R.id.streak_empty, View.VISIBLE);
            manager.updateAppWidget(appWidgetId, views);
            return;
        }

        views.setViewVisibility(R.id.streak_empty, View.GONE);
        views.setViewVisibility(R.id.streak_top, View.VISIBLE);
        views.setViewVisibility(R.id.streak_grid, View.VISIBLE);
        views.setViewVisibility(R.id.streak_hint, View.VISIBLE);

        views.setTextViewText(R.id.streak_num, String.valueOf(streak));
        views.setTextViewText(R.id.streak_title, title);
        views.setTextViewText(R.id.streak_best, zh ? "最長 " + longest : "Best " + longest);

        // 28 dots, oldest top-left (c0) → today bottom-right (c27). If the array is
        // short, the oldest cells stay empty; entries are aligned to the end.
        int len = days != null ? days.length() : 0;
        for (int i = 0; i < CELL_IDS.length; i++) {
            boolean checked = false;
            int di = len - CELL_IDS.length + i;
            if (days != null && di >= 0 && di < len) {
                JSONObject d = days.optJSONObject(di);
                checked = d != null && d.optBoolean("c", false);
            }
            views.setImageViewResource(CELL_IDS[i],
                checked ? R.drawable.streak_cell_on : R.drawable.streak_cell_off);
        }

        if (checkedToday) {
            views.setTextViewText(R.id.streak_hint, zh ? "今天已打卡 ✓" : "Done today ✓");
            views.setTextColor(R.id.streak_hint, COLOR_ACCENT);
        } else {
            views.setTextViewText(R.id.streak_hint, zh ? "今天還沒打卡" : "Not yet today");
            views.setTextColor(R.id.streak_hint, COLOR_MUTED);
        }

        manager.updateAppWidget(appWidgetId, views);
    }
}
