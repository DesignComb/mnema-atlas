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

import java.util.Calendar;

/**
 * Unified agenda widget (TickTick-style): one card with sectioned
 * ⚠ Overdue (red, original date) → Today (time-labelled) → Habits (tap to
 * check in, streak flame) so "what should I do / what's late" reads at a
 * glance. Renders into 12 morphing slots (a slot is either a section header or
 * an item row). Reads `widget_agenda` (falls back to the legacy `widget_today`
 * shape so a stale web bundle still renders); task checkboxes → TaskActionReceiver,
 * habit circles → HabitActionReceiver — both offline-capable RPC paths.
 */
public class TodayWidget extends AppWidgetProvider {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_today";        // legacy shape, still written by the web
    static final String AGENDA_KEY = "widget_agenda"; // v2 sectioned shape

    private static final int COLOR_OVERDUE = 0xFFF2A6A6;
    private static final int COLOR_MUTED = 0xFF9A9AA6;
    private static final int COLOR_ACCENT = 0xFF8AA0FF;
    private static final int COLOR_TITLE = 0xFFE8E8EE;
    private static final int COLOR_FLAME = 0xFFF2C18D;

    private static final int[] ROW_IDS = {
        R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5,
        R.id.row6, R.id.row7, R.id.row8, R.id.row9, R.id.row10, R.id.row11
    };
    private static final int[] SEC_IDS = {
        R.id.sec0, R.id.sec1, R.id.sec2, R.id.sec3, R.id.sec4, R.id.sec5,
        R.id.sec6, R.id.sec7, R.id.sec8, R.id.sec9, R.id.sec10, R.id.sec11
    };
    private static final int[] CHECK_IDS = {
        R.id.check0, R.id.check1, R.id.check2, R.id.check3, R.id.check4, R.id.check5,
        R.id.check6, R.id.check7, R.id.check8, R.id.check9, R.id.check10, R.id.check11
    };
    private static final int[] TIME_IDS = {
        R.id.time0, R.id.time1, R.id.time2, R.id.time3, R.id.time4, R.id.time5,
        R.id.time6, R.id.time7, R.id.time8, R.id.time9, R.id.time10, R.id.time11
    };
    private static final int[] TITLE_IDS = {
        R.id.title0, R.id.title1, R.id.title2, R.id.title3, R.id.title4, R.id.title5,
        R.id.title6, R.id.title7, R.id.title8, R.id.title9, R.id.title10, R.id.title11
    };

    private static final String[] WEEKDAYS_ZH = { "週日", "週一", "週二", "週三", "週四", "週五", "週六" };
    private static final String[] WEEKDAYS_EN = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    /** Called by WidgetBridge / the action receivers so a fresh snapshot shows immediately. */
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
        try {
            render(context, manager, appWidgetId);
        } catch (Exception e) {
            // Never strand "Can't load widget": fall back to the bare card.
            try {
                RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_today);
                fallback.setTextViewText(R.id.widget_title, WidgetLang.isZh(context) ? "今天" : "Today");
                manager.updateAppWidget(appWidgetId, fallback);
            } catch (Exception ignored) {
            }
        }
    }

    /** Slot cursor: renders section headers and item rows top-down into the fixed pool. */
    private static void render(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        boolean zh = WidgetLang.isZh(context);

        // Header: "今天 · 6/12 週五" — Google-style date anchoring.
        Calendar now = Calendar.getInstance();
        String wd = (zh ? WEEKDAYS_ZH : WEEKDAYS_EN)[now.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY];
        String md = (now.get(Calendar.MONTH) + 1) + "/" + now.get(Calendar.DAY_OF_MONTH);
        views.setTextViewText(R.id.widget_title, (zh ? "今天 · " : "Today · ") + md + " " + wd);
        views.setContentDescription(R.id.widget_add, zh ? "新增" : "Add");

        // Tap the card body → open the app; "+" → quick-add deep link.
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(R.id.widget_root,
                PendingIntent.getActivity(context, appWidgetId * 16, open, flags()));
        }
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("tw.dco.mnema://add"));
        add.setPackage(context.getPackageName());
        add.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.widget_add,
            PendingIntent.getActivity(context, appWidgetId * 16 + 15, add, flags()));

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject agenda = null;
        JSONObject legacy = null;
        try {
            String raw = prefs.getString(AGENDA_KEY, null);
            if (raw != null) agenda = new JSONObject(raw);
        } catch (Exception ignored) {
        }
        if (agenda == null) {
            try {
                String raw = prefs.getString(KEY, null);
                if (raw != null) legacy = new JSONObject(raw);
            } catch (Exception ignored) {
            }
        }

        int slot = 0;
        int hidden = 0; // items that didn't fit a slot

        if (agenda != null) {
            JSONArray overdue = agenda.optJSONArray("overdue");
            JSONArray today = agenda.optJSONArray("today");
            JSONArray habits = agenda.optJSONArray("habits");
            int nOver = overdue != null ? overdue.length() : 0;
            int nToday = today != null ? today.length() : 0;
            int nHabits = habits != null ? habits.length() : 0;

            // Header count: open tasks (overdue + today) · habit progress.
            int checked = 0;
            for (int i = 0; i < nHabits; i++) {
                JSONObject h = habits.optJSONObject(i);
                if (h != null && h.optBoolean("checked", false)) checked++;
            }
            StringBuilder countText = new StringBuilder();
            if (nOver + nToday > 0) countText.append(nOver + nToday).append(zh ? " 件" : "");
            if (nHabits > 0) {
                if (countText.length() > 0) countText.append(" · ");
                countText.append(checked).append("/").append(nHabits).append(zh ? " 打卡" : " habits");
            }
            views.setTextViewText(R.id.widget_count, countText.toString());

            // Cap overdue so Today/Habits stay visible on a busy day.
            int overCap = Math.min(nOver, 4);

            if (nOver > 0 && slot < ROW_IDS.length) {
                renderHeader(views, slot++, (zh ? "⚠ 已逾期" : "⚠ Overdue") + " · " + nOver, COLOR_OVERDUE);
            }
            for (int i = 0; i < nOver; i++) {
                if (i >= overCap || slot >= ROW_IDS.length) {
                    hidden += nOver - i;
                    break;
                }
                JSONObject it = overdue.optJSONObject(i);
                if (it == null) continue;
                renderTask(context, views, appWidgetId, slot++, it.optString("id", ""),
                    it.optString("title", ""), it.optString("d", ""), COLOR_OVERDUE, true, zh);
            }

            if (nToday > 0 && slot < ROW_IDS.length) {
                renderHeader(views, slot++, (zh ? "今天" : "Today") + " · " + nToday, COLOR_MUTED);
            }
            for (int i = 0; i < nToday; i++) {
                if (slot >= ROW_IDS.length) {
                    hidden += nToday - i;
                    break;
                }
                JSONObject it = today.optJSONObject(i);
                if (it == null) continue;
                String hm = it.optString("hm", "");
                boolean allDay = hm.isEmpty() || "null".equals(hm);
                renderTask(context, views, appWidgetId, slot++, it.optString("id", ""),
                    it.optString("title", ""), allDay ? (zh ? "全天" : "All-day") : hm,
                    allDay ? COLOR_MUTED : COLOR_ACCENT, false, zh);
            }

            if (nHabits > 0 && slot < ROW_IDS.length) {
                renderHeader(views, slot++, (zh ? "習慣" : "Habits") + " · " + checked + "/" + nHabits, COLOR_MUTED);
            }
            for (int i = 0; i < nHabits; i++) {
                if (slot >= ROW_IDS.length) {
                    hidden += nHabits - i;
                    break;
                }
                JSONObject h = habits.optJSONObject(i);
                if (h == null) continue;
                renderHabit(context, views, appWidgetId, slot++, h, zh);
            }

            if (nOver + nToday + nHabits == 0) {
                views.setTextViewText(R.id.widget_count, "");
                views.setTextViewText(R.id.widget_empty, zh ? "今天沒有待辦 🎉" : "All clear today 🎉");
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_empty, View.GONE);
            }
        } else if (legacy != null) {
            // Stale web bundle: render the old flat shape (no sections).
            int count = legacy.optInt("count", 0);
            JSONArray items = legacy.optJSONArray("items");
            int n = items != null ? Math.min(items.length(), ROW_IDS.length) : 0;
            for (int i = 0; i < n; i++) {
                JSONObject it = items.optJSONObject(i);
                if (it == null) continue;
                String sub = it.optString("sub", "");
                boolean over = "逾期".equals(sub) || "Overdue".equals(sub);
                renderTask(context, views, appWidgetId, slot++, it.optString("id", ""),
                    it.optString("title", ""), over ? sub : "", over ? COLOR_OVERDUE : COLOR_MUTED, over, zh);
            }
            hidden = Math.max(0, count - n);
            views.setTextViewText(R.id.widget_count, count > 0 ? (zh ? count + " 件" : String.valueOf(count)) : "");
            if (count == 0) {
                views.setTextViewText(R.id.widget_empty, zh ? "今天沒有待辦 🎉" : "All clear today 🎉");
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_empty, View.GONE);
            }
        } else {
            views.setTextViewText(R.id.widget_count, "");
            views.setTextViewText(R.id.widget_empty, zh ? "開啟 Mnema 以同步" : "Open Mnema to sync");
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        }

        for (int i = slot; i < ROW_IDS.length; i++) {
            views.setViewVisibility(ROW_IDS[i], View.GONE);
        }

        if (hidden > 0) {
            views.setTextViewText(R.id.widget_more, zh ? "還有 " + hidden + " 件…" : "+" + hidden + " more…");
            views.setViewVisibility(R.id.widget_more, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_more, View.GONE);
        }

        manager.updateAppWidget(appWidgetId, views);
    }

    private static void renderHeader(RemoteViews views, int slot, String text, int color) {
        views.setViewVisibility(ROW_IDS[slot], View.VISIBLE);
        views.setViewVisibility(SEC_IDS[slot], View.VISIBLE);
        views.setViewVisibility(CHECK_IDS[slot], View.GONE);
        views.setViewVisibility(TIME_IDS[slot], View.GONE);
        views.setViewVisibility(TITLE_IDS[slot], View.GONE);
        views.setTextViewText(SEC_IDS[slot], text);
        views.setTextColor(SEC_IDS[slot], color);
    }

    private static void renderTask(Context context, RemoteViews views, int appWidgetId, int slot,
                                   String taskId, String title, String time, int timeColor,
                                   boolean overdue, boolean zh) {
        views.setViewVisibility(ROW_IDS[slot], View.VISIBLE);
        views.setViewVisibility(SEC_IDS[slot], View.GONE);
        views.setViewVisibility(CHECK_IDS[slot], View.VISIBLE);
        views.setImageViewResource(CHECK_IDS[slot], R.drawable.ic_widget_check);
        views.setContentDescription(CHECK_IDS[slot], zh ? "完成" : "Complete");
        if (time == null || time.isEmpty()) {
            views.setViewVisibility(TIME_IDS[slot], View.GONE);
        } else {
            views.setViewVisibility(TIME_IDS[slot], View.VISIBLE);
            views.setTextViewText(TIME_IDS[slot], time);
            views.setTextColor(TIME_IDS[slot], timeColor);
        }
        views.setViewVisibility(TITLE_IDS[slot], View.VISIBLE);
        views.setTextViewText(TITLE_IDS[slot], title);
        views.setTextColor(TITLE_IDS[slot], overdue ? COLOR_OVERDUE : COLOR_TITLE);

        Intent done = new Intent(context, TaskActionReceiver.class);
        done.setAction(TaskActionReceiver.ACTION_COMPLETE);
        done.putExtra(TaskActionReceiver.EXTRA_TASK_ID, taskId);
        views.setOnClickPendingIntent(CHECK_IDS[slot],
            PendingIntent.getBroadcast(context, appWidgetId * 16 + slot, done, flags()));
    }

    private static void renderHabit(Context context, RemoteViews views, int appWidgetId, int slot,
                                    JSONObject habit, boolean zh) {
        String habitId = habit.optString("id", "");
        boolean checked = habit.optBoolean("checked", false);
        int streak = habit.optInt("streak", 0);

        views.setViewVisibility(ROW_IDS[slot], View.VISIBLE);
        views.setViewVisibility(SEC_IDS[slot], View.GONE);
        views.setViewVisibility(CHECK_IDS[slot], View.VISIBLE);
        views.setImageViewResource(CHECK_IDS[slot],
            checked ? R.drawable.ic_widget_check_filled : R.drawable.ic_widget_check);
        views.setContentDescription(CHECK_IDS[slot], zh ? "打卡" : "Check in");

        if (streak > 0) {
            views.setViewVisibility(TIME_IDS[slot], View.VISIBLE);
            views.setTextViewText(TIME_IDS[slot], "🔥" + streak);
            views.setTextColor(TIME_IDS[slot], COLOR_FLAME);
        } else {
            views.setViewVisibility(TIME_IDS[slot], View.GONE);
        }
        views.setViewVisibility(TITLE_IDS[slot], View.VISIBLE);
        views.setTextViewText(TITLE_IDS[slot], habit.optString("title", ""));
        views.setTextColor(TITLE_IDS[slot], checked ? COLOR_MUTED : COLOR_TITLE);

        Intent toggle = new Intent(context, HabitActionReceiver.class);
        toggle.setAction(HabitActionReceiver.ACTION_TOGGLE);
        toggle.putExtra(HabitActionReceiver.EXTRA_HABIT_ID, habitId);
        toggle.putExtra(HabitActionReceiver.EXTRA_CHECKED, checked);
        views.setOnClickPendingIntent(CHECK_IDS[slot],
            PendingIntent.getBroadcast(context, appWidgetId * 16 + slot, toggle, flags()));
    }
}
