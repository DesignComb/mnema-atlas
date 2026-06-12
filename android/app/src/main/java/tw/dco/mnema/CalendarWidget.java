package tw.dco.mnema;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * TickTick-style calendar widget: a pageable Sunday-start month grid where every
 * day is tappable, plus an agenda pane for the selected day — each agenda row
 * has a complete-checkbox wired to TaskActionReceiver (same offline-capable RPC
 * path as the Today widget). Data comes from the `widget_calendar` snapshot the
 * web app writes ({date, days:{date:[{id,title,hm}]}, holidays:{date:name}});
 * month/selection state is native, per widget id, in the same prefs file.
 * Tap ‹ › to page months, the month label to jump back to today, a day to see
 * its agenda, the agenda to open the in-app calendar.
 */
public class CalendarWidget extends AppWidgetProvider {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_calendar";

    static final String ACTION_SELECT = "tw.dco.mnema.CAL_SELECT";
    static final String ACTION_MONTH = "tw.dco.mnema.CAL_MONTH";
    static final String ACTION_RESET = "tw.dco.mnema.CAL_RESET";
    static final String EXTRA_WIDGET = "widget_id";
    static final String EXTRA_DATE = "date";
    static final String EXTRA_DELTA = "delta";

    private static final int COLOR_DAY = 0xFFE8E8EE;     // normal day number
    private static final int COLOR_DIM = 0xFF6A6A76;     // weekend number
    private static final int COLOR_BUSY = 0xFFAEC0FF;    // accent: has tasks
    private static final int COLOR_HOLIDAY = 0xFFF2A6A6; // TW convention: holidays read red
    private static final int COLOR_TODAY = 0xFF1A1B22;   // dark text on the brand pill
    private static final int COLOR_TITLE = 0xFFE8E8EE;
    private static final int COLOR_MUTED = 0xFF9A9AA6;

    private static final int[] CELL_IDS = {
        R.id.cell0,  R.id.cell1,  R.id.cell2,  R.id.cell3,  R.id.cell4,  R.id.cell5,  R.id.cell6,
        R.id.cell7,  R.id.cell8,  R.id.cell9,  R.id.cell10, R.id.cell11, R.id.cell12, R.id.cell13,
        R.id.cell14, R.id.cell15, R.id.cell16, R.id.cell17, R.id.cell18, R.id.cell19, R.id.cell20,
        R.id.cell21, R.id.cell22, R.id.cell23, R.id.cell24, R.id.cell25, R.id.cell26, R.id.cell27,
        R.id.cell28, R.id.cell29, R.id.cell30, R.id.cell31, R.id.cell32, R.id.cell33, R.id.cell34,
        R.id.cell35, R.id.cell36, R.id.cell37, R.id.cell38, R.id.cell39, R.id.cell40, R.id.cell41
    };

    private static final int[] WEEKDAY_IDS = {
        R.id.wd0, R.id.wd1, R.id.wd2, R.id.wd3, R.id.wd4, R.id.wd5, R.id.wd6
    };
    private static final int[] AG_ROW_IDS = { R.id.ag_row0, R.id.ag_row1, R.id.ag_row2, R.id.ag_row3 };
    private static final int[] AG_CHECK_IDS = { R.id.ag_check0, R.id.ag_check1, R.id.ag_check2, R.id.ag_check3 };
    private static final int[] AG_TIME_IDS = { R.id.ag_time0, R.id.ag_time1, R.id.ag_time2, R.id.ag_time3 };
    private static final int[] AG_TITLE_IDS = { R.id.ag_title0, R.id.ag_title1, R.id.ag_title2, R.id.ag_title3 };

    private static final String[] WEEKDAYS_ZH = { "日", "一", "二", "三", "四", "五", "六" };
    private static final String[] WEEKDAYS_EN = { "S", "M", "T", "W", "T", "F", "S" };
    private static final String[] MONTHS_EN = {
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateWidget(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_SELECT.equals(action) || ACTION_MONTH.equals(action) || ACTION_RESET.equals(action)) {
            int widgetId = intent.getIntExtra(EXTRA_WIDGET, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = prefs.edit();
            if (ACTION_SELECT.equals(action)) {
                String date = intent.getStringExtra(EXTRA_DATE);
                if (date != null && !date.isEmpty()) ed.putString(selKey(widgetId), date);
            } else if (ACTION_MONTH.equals(action)) {
                int delta = intent.getIntExtra(EXTRA_DELTA, 0);
                int off = prefs.getInt(offKey(widgetId), 0) + delta;
                ed.putInt(offKey(widgetId), Math.max(-24, Math.min(24, off)));
                ed.remove(selKey(widgetId)); // new month → selection resets (today / day 1)
            } else {
                ed.putInt(offKey(widgetId), 0);
                ed.remove(selKey(widgetId));
            }
            ed.apply();
            updateWidget(context, AppWidgetManager.getInstance(context), widgetId);
            return;
        }
        super.onReceive(context, intent);
    }

    /** Called by WidgetBridge so a fresh snapshot shows immediately. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, CalendarWidget.class))) {
            updateWidget(context, manager, id);
        }
    }

    private static String selKey(int widgetId) {
        return "widget_calendar_sel_" + widgetId;
    }

    private static String offKey(int widgetId) {
        return "widget_calendar_off_" + widgetId;
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    /** Day number (optionally bold) + a shrunken dot line when the day has tasks. */
    private static CharSequence cellText(int day, boolean busy, boolean boldNum) {
        String num = String.valueOf(day);
        String text = busy ? num + "\n•" : num;
        SpannableString span = new SpannableString(text);
        if (boldNum) span.setSpan(new StyleSpan(Typeface.BOLD), 0, num.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (busy) {
            span.setSpan(new android.text.style.RelativeSizeSpan(0.55f),
                num.length(), text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return span;
    }

    private static PendingIntent broadcast(Context context, int requestCode, Intent intent) {
        intent.setPackage(context.getPackageName());
        return PendingIntent.getBroadcast(context, requestCode, intent, flags());
    }

    private static String iso(int y, int m, int d) {
        return String.format(Locale.US, "%04d-%02d-%02d", y, m, d);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget);
        boolean zh = WidgetLang.isZh(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        for (int i = 0; i < WEEKDAY_IDS.length; i++) {
            views.setTextViewText(WEEKDAY_IDS[i], zh ? WEEKDAYS_ZH[i] : WEEKDAYS_EN[i]);
        }

        // Snapshot: per-day items + holiday names (may be missing on first run).
        JSONObject days = null;
        JSONObject holidays = null;
        try {
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                JSONObject snap = new JSONObject(raw);
                days = snap.optJSONObject("days");
                holidays = snap.optJSONObject("holidays");
            }
        } catch (Exception e) {
            // Bad snapshot — render the bare month.
        }

        // Month being shown: device clock + per-widget paging offset.
        Calendar now = Calendar.getInstance();
        String today = iso(now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
        Calendar shown = Calendar.getInstance();
        shown.set(Calendar.DAY_OF_MONTH, 1);
        int offset = prefs.getInt(offKey(appWidgetId), 0);
        shown.add(Calendar.MONTH, offset);
        int year = shown.get(Calendar.YEAR);
        int month = shown.get(Calendar.MONTH) + 1;

        // Selected day: stored tap, else today (current month) / the 1st (other months).
        String selected = prefs.getString(selKey(appWidgetId), null);
        String monthPrefix = String.format(Locale.US, "%04d-%02d-", year, month);
        if (selected == null || !selected.startsWith(monthPrefix)) {
            selected = offset == 0 ? today : monthPrefix + "01";
        }

        views.setTextViewText(R.id.cal_month,
            zh ? year + "年" + month + "月" : MONTHS_EN[month - 1] + " " + year);

        // Header controls: page months, tap the label to jump back to today.
        views.setOnClickPendingIntent(R.id.btn_prev, broadcast(context, appWidgetId * 100 + 90,
            new Intent(context, CalendarWidget.class).setAction(ACTION_MONTH)
                .putExtra(EXTRA_WIDGET, appWidgetId).putExtra(EXTRA_DELTA, -1)));
        views.setOnClickPendingIntent(R.id.btn_next, broadcast(context, appWidgetId * 100 + 91,
            new Intent(context, CalendarWidget.class).setAction(ACTION_MONTH)
                .putExtra(EXTRA_WIDGET, appWidgetId).putExtra(EXTRA_DELTA, 1)));
        views.setOnClickPendingIntent(R.id.cal_month, broadcast(context, appWidgetId * 100 + 92,
            new Intent(context, CalendarWidget.class).setAction(ACTION_RESET)
                .putExtra(EXTRA_WIDGET, appWidgetId)));

        // Sunday-start grid: offset = weekday of the 1st (0 = Sunday).
        Calendar first = Calendar.getInstance();
        first.clear();
        first.set(year, month - 1, 1);
        int firstOffset = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY; // 0..6
        int daysInMonth = first.getActualMaximum(Calendar.DAY_OF_MONTH);

        for (int i = 0; i < CELL_IDS.length; i++) {
            int day = i - firstOffset + 1;
            if (day < 1 || day > daysInMonth) {
                views.setTextViewText(CELL_IDS[i], "");
                views.setInt(CELL_IDS[i], "setBackgroundResource", 0);
                views.setOnClickPendingIntent(CELL_IDS[i], null);
                continue;
            }

            String dateKey = iso(year, month, day);
            boolean isToday = dateKey.equals(today);
            boolean isSelected = dateKey.equals(selected);
            boolean isHoliday = holidays != null && holidays.has(dateKey);
            boolean isWeekend = i % 7 == 0 || i % 7 == 6;
            JSONArray items = days != null ? days.optJSONArray(dateKey) : null;
            boolean busy = items != null && items.length() > 0;

            // Two lines: the number, then a small dot line for days with tasks
            // (TickTick's grid language; a Spannable keeps it one TextView).
            views.setTextViewText(CELL_IDS[i], cellText(day, busy, isToday || busy));

            if (isToday) {
                views.setTextColor(CELL_IDS[i], COLOR_TODAY);
                views.setInt(CELL_IDS[i], "setBackgroundResource", R.drawable.widget_today_cell);
            } else {
                views.setTextColor(CELL_IDS[i],
                    isHoliday ? COLOR_HOLIDAY : busy ? COLOR_BUSY : isWeekend ? COLOR_DIM : COLOR_DAY);
                views.setInt(CELL_IDS[i], "setBackgroundResource",
                    isSelected ? R.drawable.widget_selected_cell : 0);
            }

            views.setOnClickPendingIntent(CELL_IDS[i], broadcast(context, appWidgetId * 100 + i,
                new Intent(context, CalendarWidget.class).setAction(ACTION_SELECT)
                    .putExtra(EXTRA_WIDGET, appWidgetId).putExtra(EXTRA_DATE, dateKey)));
        }

        renderAgenda(context, views, appWidgetId, selected, today, days, holidays, zh);

        manager.updateAppWidget(appWidgetId, views);
    }

    /** Agenda pane: up to 4 of the selected day's tasks + "+N more" + empty/holiday line. */
    private static void renderAgenda(Context context, RemoteViews views, int appWidgetId,
                                     String selected, String today, JSONObject days,
                                     JSONObject holidays, boolean zh) {
        // Header: "今天 · 6/12" / "Jun 12" (+ holiday name when there is one).
        String[] parts = selected.split("-");
        int m = Integer.parseInt(parts[1]);
        int d = Integer.parseInt(parts[2]);
        String dayLabel = selected.equals(today)
            ? (zh ? "今天" : "Today")
            : (zh ? m + "/" + d : MONTHS_EN[m - 1].substring(0, 3) + " " + d);
        String holiday = holidays != null ? holidays.optString(selected, "") : "";
        views.setTextViewText(R.id.ag_header,
            holiday.isEmpty() ? dayLabel : dayLabel + " · " + holiday);

        JSONArray items = days != null ? days.optJSONArray(selected) : null;
        int count = items != null ? items.length() : 0;

        // The agenda area opens the in-app calendar.
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("tw.dco.mnema://calendar"));
        open.setPackage(context.getPackageName());
        PendingIntent openCal = PendingIntent.getActivity(context, appWidgetId * 100 + 93, open, flags());
        views.setOnClickPendingIntent(R.id.ag_header, openCal);
        views.setOnClickPendingIntent(R.id.ag_empty, openCal);
        views.setOnClickPendingIntent(R.id.ag_more, openCal);

        for (int i = 0; i < AG_ROW_IDS.length; i++) {
            if (i >= count) {
                views.setViewVisibility(AG_ROW_IDS[i], View.GONE);
                continue;
            }
            JSONObject it = items.optJSONObject(i);
            if (it == null) {
                views.setViewVisibility(AG_ROW_IDS[i], View.GONE);
                continue;
            }
            views.setViewVisibility(AG_ROW_IDS[i], View.VISIBLE);
            String hm = it.optString("hm", "");
            views.setTextViewText(AG_TIME_IDS[i], hm.isEmpty() || "null".equals(hm) ? (zh ? "全天" : "All-day") : hm);
            views.setTextViewText(AG_TITLE_IDS[i], it.optString("title", ""));
            views.setOnClickPendingIntent(AG_TITLE_IDS[i], openCal);
            // The check circle completes the task — same receiver as the Today widget.
            String taskId = it.optString("id", "");
            views.setContentDescription(AG_CHECK_IDS[i], zh ? "完成" : "Complete");
            views.setOnClickPendingIntent(AG_CHECK_IDS[i], broadcast(context, appWidgetId * 100 + 94 + i,
                new Intent(context, TaskActionReceiver.class).setAction(TaskActionReceiver.ACTION_COMPLETE)
                    .putExtra(TaskActionReceiver.EXTRA_TASK_ID, taskId)));
        }

        if (count > AG_ROW_IDS.length) {
            int more = count - AG_ROW_IDS.length;
            views.setViewVisibility(R.id.ag_more, View.VISIBLE);
            views.setTextViewText(R.id.ag_more, zh ? "還有 " + more + " 件…" : "+" + more + " more…");
        } else {
            views.setViewVisibility(R.id.ag_more, View.GONE);
        }

        if (count == 0) {
            views.setViewVisibility(R.id.ag_empty, View.VISIBLE);
            views.setTextViewText(R.id.ag_empty,
                days == null
                    ? (zh ? "開啟 Mnema 以同步…" : "Open Mnema to sync…")
                    : (zh ? "沒有待辦 🎉" : "Nothing due 🎉"));
        } else {
            views.setViewVisibility(R.id.ag_empty, View.GONE);
        }
    }
}
