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
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Google-Calendar-style widget: a pageable Sunday-start month grid where each
 * day shows 代辦/打卡 density dots, plus an agenda for the selected day that runs
 * the whole Tempo day — to-dos complete (TaskActionReceiver) and habits check in
 * (HabitActionReceiver), both the same offline-capable RPC paths as the Today
 * widget. Data: the `widget_calendar` snapshot
 * ({date, habitCount, habits:[{id,title,streak}], days:{date:{todos:[{id,title,hm}],td,hc:[id]}}, holidays}).
 * Month/selection state is native, per widget id, in the same prefs file.
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
    private static final int COLOR_TODO = 0xFF8AA0FF;    // accent: to-do dot
    private static final int COLOR_HABIT = 0xFFF2C18D;   // flame: habit check-in dot
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
    private static final int[] AG_ROW_IDS = {
        R.id.ag_row0, R.id.ag_row1, R.id.ag_row2, R.id.ag_row3, R.id.ag_row4, R.id.ag_row5, R.id.ag_row6
    };
    private static final int[] AG_SEC_IDS = {
        R.id.ag_sec0, R.id.ag_sec1, R.id.ag_sec2, R.id.ag_sec3, R.id.ag_sec4, R.id.ag_sec5, R.id.ag_sec6
    };
    private static final int[] AG_CHECK_IDS = {
        R.id.ag_check0, R.id.ag_check1, R.id.ag_check2, R.id.ag_check3, R.id.ag_check4, R.id.ag_check5, R.id.ag_check6
    };
    private static final int[] AG_TIME_IDS = {
        R.id.ag_time0, R.id.ag_time1, R.id.ag_time2, R.id.ag_time3, R.id.ag_time4, R.id.ag_time5, R.id.ag_time6
    };
    private static final int[] AG_TITLE_IDS = {
        R.id.ag_title0, R.id.ag_title1, R.id.ag_title2, R.id.ag_title3, R.id.ag_title4, R.id.ag_title5, R.id.ag_title6
    };

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

    private static PendingIntent broadcast(Context context, int requestCode, Intent intent) {
        intent.setPackage(context.getPackageName());
        return PendingIntent.getBroadcast(context, requestCode, intent, flags());
    }

    private static String iso(int y, int m, int d) {
        return String.format(Locale.US, "%04d-%02d-%02d", y, m, d);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        try {
            render(context, manager, appWidgetId);
        } catch (Exception e) {
            // Never strand "Can't load widget": fall back to a bare month label.
            try {
                RemoteViews fb = new RemoteViews(context.getPackageName(), R.layout.calendar_widget);
                Calendar now = Calendar.getInstance();
                fb.setTextViewText(R.id.cal_month, WidgetLang.isZh(context)
                    ? now.get(Calendar.YEAR) + "年" + (now.get(Calendar.MONTH) + 1) + "月"
                    : MONTHS_EN[now.get(Calendar.MONTH)] + " " + now.get(Calendar.YEAR));
                manager.updateAppWidget(appWidgetId, fb);
            } catch (Exception ignored) {
            }
        }
    }

    /** Day number (optionally bold) + a colored dot line: accent = open to-dos,
     *  flame = habit check-ins. Google-Calendar density in a single TextView. */
    private static CharSequence cellText(int day, int todoCount, int habitCount, boolean boldNum) {
        String num = String.valueOf(day);
        SpannableStringBuilder b = new SpannableStringBuilder(num);
        if (boldNum) b.setSpan(new StyleSpan(Typeface.BOLD), 0, num.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (todoCount > 0 || habitCount > 0) {
            int dotStart = b.length();
            b.append("\n");
            if (todoCount > 0) {
                int s = b.length();
                b.append("•");
                b.setSpan(new ForegroundColorSpan(COLOR_TODO), s, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            if (habitCount > 0) {
                int s = b.length();
                b.append("•");
                b.setSpan(new ForegroundColorSpan(COLOR_HABIT), s, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            b.setSpan(new RelativeSizeSpan(0.55f), dotStart, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return b;
    }

    private static void render(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget);
        boolean zh = WidgetLang.isZh(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        for (int i = 0; i < WEEKDAY_IDS.length; i++) {
            views.setTextViewText(WEEKDAY_IDS[i], zh ? WEEKDAYS_ZH[i] : WEEKDAYS_EN[i]);
        }

        JSONObject days = null;
        JSONObject holidays = null;
        JSONArray habits = null;
        int habitCount = 0;
        try {
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                JSONObject snap = new JSONObject(raw);
                days = snap.optJSONObject("days");
                holidays = snap.optJSONObject("holidays");
                habits = snap.optJSONArray("habits");
                habitCount = snap.optInt("habitCount", habits != null ? habits.length() : 0);
            }
        } catch (Exception e) {
            // Bad snapshot — render the bare month.
        }

        Calendar now = Calendar.getInstance();
        String today = iso(now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
        Calendar shown = Calendar.getInstance();
        shown.set(Calendar.DAY_OF_MONTH, 1);
        int offset = prefs.getInt(offKey(appWidgetId), 0);
        shown.add(Calendar.MONTH, offset);
        int year = shown.get(Calendar.YEAR);
        int month = shown.get(Calendar.MONTH) + 1;

        String selected = prefs.getString(selKey(appWidgetId), null);
        String monthPrefix = String.format(Locale.US, "%04d-%02d-", year, month);
        if (selected == null || !selected.startsWith(monthPrefix)) {
            selected = offset == 0 ? today : monthPrefix + "01";
        }

        views.setTextViewText(R.id.cal_month,
            zh ? year + "年" + month + "月" : MONTHS_EN[month - 1] + " " + year);

        views.setOnClickPendingIntent(R.id.btn_prev, broadcast(context, appWidgetId * 100 + 90,
            new Intent(context, CalendarWidget.class).setAction(ACTION_MONTH)
                .putExtra(EXTRA_WIDGET, appWidgetId).putExtra(EXTRA_DELTA, -1)));
        views.setOnClickPendingIntent(R.id.btn_next, broadcast(context, appWidgetId * 100 + 91,
            new Intent(context, CalendarWidget.class).setAction(ACTION_MONTH)
                .putExtra(EXTRA_WIDGET, appWidgetId).putExtra(EXTRA_DELTA, 1)));
        views.setOnClickPendingIntent(R.id.cal_month, broadcast(context, appWidgetId * 100 + 92,
            new Intent(context, CalendarWidget.class).setAction(ACTION_RESET)
                .putExtra(EXTRA_WIDGET, appWidgetId)));

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
                views.setOnClickPendingIntent(CELL_IDS[i], broadcast(context, appWidgetId * 100 + i,
                    new Intent(context, CalendarWidget.class).setAction(ACTION_SELECT)
                        .putExtra(EXTRA_WIDGET, appWidgetId)));
                continue;
            }

            String dateKey = iso(year, month, day);
            boolean isToday = dateKey.equals(today);
            boolean isSelected = dateKey.equals(selected);
            boolean isHoliday = holidays != null && holidays.has(dateKey);
            boolean isWeekend = i % 7 == 0 || i % 7 == 6;
            JSONObject dayObj = days != null ? days.optJSONObject(dateKey) : null;
            int todoOpen = 0, hcCount = 0;
            if (dayObj != null) {
                JSONArray td = dayObj.optJSONArray("todos");
                todoOpen = td != null ? td.length() : 0;
                JSONArray hc = dayObj.optJSONArray("hc");
                hcCount = hc != null ? hc.length() : 0;
            }
            boolean busy = todoOpen > 0 || hcCount > 0;

            views.setTextViewText(CELL_IDS[i], cellText(day, todoOpen, hcCount, isToday || busy));
            if (isToday) {
                views.setTextColor(CELL_IDS[i], COLOR_TODAY);
                views.setInt(CELL_IDS[i], "setBackgroundResource", R.drawable.widget_today_cell);
            } else {
                views.setTextColor(CELL_IDS[i], isHoliday ? COLOR_HOLIDAY : isWeekend ? COLOR_DIM : COLOR_DAY);
                views.setInt(CELL_IDS[i], "setBackgroundResource",
                    isSelected ? R.drawable.widget_selected_cell : 0);
            }
            views.setOnClickPendingIntent(CELL_IDS[i], broadcast(context, appWidgetId * 100 + i,
                new Intent(context, CalendarWidget.class).setAction(ACTION_SELECT)
                    .putExtra(EXTRA_WIDGET, appWidgetId).putExtra(EXTRA_DATE, dateKey)));
        }

        renderAgenda(context, views, appWidgetId, selected, today, days, holidays, habits, habitCount, zh);
        manager.updateAppWidget(appWidgetId, views);
    }

    /** Agenda: 代辦 X/Y · 打卡 X/Y header, then 代辦 (complete) + 打卡 (check in)
     *  sections across 7 morphing slots. Habits are checkable for today; on other
     *  days they show that day's check-in state read-only. */
    private static void renderAgenda(Context context, RemoteViews views, int appWidgetId,
                                     String selected, String today, JSONObject days,
                                     JSONObject holidays, JSONArray habits, int habitCount, boolean zh) {
        String[] parts = selected.split("-");
        int m = Integer.parseInt(parts[1]);
        int d = Integer.parseInt(parts[2]);
        boolean isToday = selected.equals(today);
        String dayLabel = isToday ? (zh ? "今天" : "Today")
            : (zh ? m + "/" + d : MONTHS_EN[m - 1].substring(0, 3) + " " + d);

        JSONObject dayObj = days != null ? days.optJSONObject(selected) : null;
        JSONArray todos = dayObj != null ? dayObj.optJSONArray("todos") : null;
        int todoOpen = todos != null ? todos.length() : 0;
        int todoDone = dayObj != null ? dayObj.optInt("td", 0) : 0;
        Set<String> checkedHabits = new HashSet<>();
        if (dayObj != null) {
            JSONArray hc = dayObj.optJSONArray("hc");
            if (hc != null) for (int i = 0; i < hc.length(); i++) checkedHabits.add(hc.optString(i, ""));
        }
        int nHabits = habits != null ? habits.length() : 0;
        int habitDone = checkedHabits.size();

        // Header: day · 代辦 X/Y · 打卡 X/Y (+ holiday name).
        StringBuilder header = new StringBuilder(dayLabel);
        String holiday = holidays != null ? holidays.optString(selected, "") : "";
        if (!holiday.isEmpty()) header.append(" · ").append(holiday);
        if (todoOpen + todoDone > 0) {
            header.append(zh ? " · 代辦 " : " · To-do ").append(todoDone).append("/").append(todoOpen + todoDone);
        }
        if (habitCount > 0) {
            header.append(zh ? " · 打卡 " : " · Habits ").append(habitDone).append("/").append(habitCount);
        }
        views.setTextViewText(R.id.ag_header, header.toString());

        Intent openCal = new Intent(Intent.ACTION_VIEW, Uri.parse("tw.dco.mnema://calendar"));
        openCal.setPackage(context.getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(context, appWidgetId * 100 + 93, openCal, flags());
        views.setOnClickPendingIntent(R.id.ag_header, openPi);
        views.setOnClickPendingIntent(R.id.ag_empty, openPi);
        views.setOnClickPendingIntent(R.id.ag_more, openPi);

        int slot = 0;
        int hidden = 0;
        // When both sections exist, cap to-dos so habits stay visible.
        int maxTodo = nHabits > 0 ? 3 : 6;

        if (todoOpen > 0 && slot < AG_ROW_IDS.length) {
            renderSection(views, slot++, zh ? "代辦" : "To-do");
        }
        for (int i = 0; i < todoOpen; i++) {
            if (i >= maxTodo || slot >= AG_ROW_IDS.length) { hidden += todoOpen - i; break; }
            JSONObject it = todos.optJSONObject(i);
            if (it == null) continue;
            String hm = it.optString("hm", "");
            boolean allDay = hm.isEmpty() || "null".equals(hm);
            renderTodo(context, views, appWidgetId, slot++, it.optString("id", ""),
                it.optString("title", ""), allDay ? (zh ? "全天" : "All-day") : hm, zh);
        }

        if (nHabits > 0 && slot < AG_ROW_IDS.length) {
            renderSection(views, slot++, (zh ? "打卡 " : "Habits ") + habitDone + "/" + habitCount);
        }
        for (int i = 0; i < nHabits; i++) {
            if (slot >= AG_ROW_IDS.length) { hidden += nHabits - i; break; }
            JSONObject h = habits.optJSONObject(i);
            if (h == null) continue;
            String id = h.optString("id", "");
            boolean checked = checkedHabits.contains(id);
            renderHabit(context, views, appWidgetId, slot++, id, h.optString("title", ""),
                h.optInt("streak", 0), checked, isToday, zh);
        }

        for (int i = slot; i < AG_ROW_IDS.length; i++) {
            views.setViewVisibility(AG_ROW_IDS[i], View.GONE);
        }

        if (hidden > 0) {
            views.setViewVisibility(R.id.ag_more, View.VISIBLE);
            views.setTextViewText(R.id.ag_more, zh ? "還有 " + hidden + " 件…" : "+" + hidden + " more…");
        } else {
            views.setViewVisibility(R.id.ag_more, View.GONE);
        }

        if (slot == 0) {
            views.setViewVisibility(R.id.ag_empty, View.VISIBLE);
            views.setTextViewText(R.id.ag_empty, days == null
                ? (zh ? "開啟 Mnema 以同步…" : "Open Mnema to sync…")
                : (zh ? "沒有待辦 🎉" : "Nothing due 🎉"));
        } else {
            views.setViewVisibility(R.id.ag_empty, View.GONE);
        }
    }

    private static void renderSection(RemoteViews views, int slot, String text) {
        views.setViewVisibility(AG_ROW_IDS[slot], View.VISIBLE);
        views.setViewVisibility(AG_SEC_IDS[slot], View.VISIBLE);
        views.setViewVisibility(AG_CHECK_IDS[slot], View.GONE);
        views.setViewVisibility(AG_TIME_IDS[slot], View.GONE);
        views.setViewVisibility(AG_TITLE_IDS[slot], View.GONE);
        views.setTextViewText(AG_SEC_IDS[slot], text);
    }

    private static void renderTodo(Context context, RemoteViews views, int appWidgetId, int slot,
                                   String taskId, String title, String time, boolean zh) {
        views.setViewVisibility(AG_ROW_IDS[slot], View.VISIBLE);
        views.setViewVisibility(AG_SEC_IDS[slot], View.GONE);
        views.setViewVisibility(AG_CHECK_IDS[slot], View.VISIBLE);
        views.setImageViewResource(AG_CHECK_IDS[slot], R.drawable.ic_widget_check);
        views.setContentDescription(AG_CHECK_IDS[slot], zh ? "完成" : "Complete");
        views.setViewVisibility(AG_TIME_IDS[slot], View.VISIBLE);
        views.setTextViewText(AG_TIME_IDS[slot], time);
        views.setTextColor(AG_TIME_IDS[slot], COLOR_TODO);
        views.setViewVisibility(AG_TITLE_IDS[slot], View.VISIBLE);
        views.setTextViewText(AG_TITLE_IDS[slot], title);
        views.setTextColor(AG_TITLE_IDS[slot], COLOR_TITLE);

        Intent done = new Intent(context, TaskActionReceiver.class);
        done.setAction(TaskActionReceiver.ACTION_COMPLETE);
        done.putExtra(TaskActionReceiver.EXTRA_TASK_ID, taskId);
        // requestCode 60+slot: clear of grid cells (0..41) and nav (90..93).
        views.setOnClickPendingIntent(AG_CHECK_IDS[slot],
            broadcast(context, appWidgetId * 100 + 60 + slot, done));
    }

    private static void renderHabit(Context context, RemoteViews views, int appWidgetId, int slot,
                                    String habitId, String title, int streak, boolean checked,
                                    boolean isToday, boolean zh) {
        views.setViewVisibility(AG_ROW_IDS[slot], View.VISIBLE);
        views.setViewVisibility(AG_SEC_IDS[slot], View.GONE);
        views.setViewVisibility(AG_CHECK_IDS[slot], View.VISIBLE);
        views.setImageViewResource(AG_CHECK_IDS[slot],
            checked ? R.drawable.ic_widget_check_filled : R.drawable.ic_widget_check);
        views.setContentDescription(AG_CHECK_IDS[slot], zh ? "打卡" : "Check in");
        if (streak > 0) {
            views.setViewVisibility(AG_TIME_IDS[slot], View.VISIBLE);
            views.setTextViewText(AG_TIME_IDS[slot], "🔥" + streak);
            views.setTextColor(AG_TIME_IDS[slot], COLOR_HABIT);
        } else {
            views.setViewVisibility(AG_TIME_IDS[slot], View.GONE);
        }
        views.setViewVisibility(AG_TITLE_IDS[slot], View.VISIBLE);
        views.setTextViewText(AG_TITLE_IDS[slot], title);
        views.setTextColor(AG_TITLE_IDS[slot], checked ? COLOR_MUTED : COLOR_TITLE);

        if (isToday) {
            // Reset-aware toggle_check_in is for "today" only — checkable here.
            Intent toggle = new Intent(context, HabitActionReceiver.class);
            toggle.setAction(HabitActionReceiver.ACTION_TOGGLE);
            toggle.putExtra(HabitActionReceiver.EXTRA_HABIT_ID, habitId);
            toggle.putExtra(HabitActionReceiver.EXTRA_CHECKED, checked);
            // requestCode 70+slot: clear of cells, nav and the to-do range.
            views.setOnClickPendingIntent(AG_CHECK_IDS[slot],
                broadcast(context, appWidgetId * 100 + 70 + slot, toggle));
        } else {
            // Past/future day: check-in state is read-only (open the app to backfill).
            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("tw.dco.mnema://calendar"));
            open.setPackage(context.getPackageName());
            views.setOnClickPendingIntent(AG_CHECK_IDS[slot],
                PendingIntent.getActivity(context, appWidgetId * 100 + 70 + slot, open, flags()));
        }
    }
}
