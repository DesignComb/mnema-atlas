package tw.dco.mnema;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Dark month-calendar widget: Sunday-start 6×7 grid for the snapshot's month.
 * Days with bookings/tasks ("busy") render in the brand accent + bold; today
 * gets a filled pill. Reads the snapshot the web app wrote (SharedPreferences
 * "CapacitorStorage", key "widget_calendar"); if it's missing we still draw the
 * device's current month so the widget never looks broken. Tap → open the app.
 */
public class CalendarWidget extends AppWidgetProvider {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_calendar";

    private static final int COLOR_DAY = 0xFFE8E8EE;    // normal day number
    private static final int COLOR_BUSY = 0xFFAEC0FF;   // accent: has events
    private static final int COLOR_TODAY = 0xFF1A1B22;  // dark text on the brand pill

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

    /** Called by WidgetBridge so a fresh snapshot shows immediately. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, CalendarWidget.class))) {
            updateWidget(context, manager, id);
        }
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static CharSequence bold(String s) {
        SpannableString span = new SpannableString(s);
        span.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return span;
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget);

        boolean zh = WidgetLang.isZh(context);
        for (int i = 0; i < WEEKDAY_IDS.length; i++) {
            views.setTextViewText(WEEKDAY_IDS[i], zh ? WEEKDAYS_ZH[i] : WEEKDAYS_EN[i]);
        }

        // Tap anywhere → open the app.
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(R.id.calendar_root,
                PendingIntent.getActivity(context, appWidgetId * 16, open, flags()));
        }

        // Defaults: device clock, no busy days — used when the snapshot is missing/bad.
        Calendar now = Calendar.getInstance();
        int year = now.get(Calendar.YEAR);
        int month = now.get(Calendar.MONTH) + 1; // 1-based
        String today = String.format(Locale.US, "%04d-%02d-%02d",
            year, month, now.get(Calendar.DAY_OF_MONTH));
        JSONObject busy = null;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                JSONObject snap = new JSONObject(raw);
                int y = snap.optInt("year", 0);
                int m = snap.optInt("month", 0);
                if (y >= 1970 && m >= 1 && m <= 12) {
                    year = y;
                    month = m;
                    // `today` stays device-derived: the snapshot's date is just
                    // "when the app last synced" — trusting it highlights
                    // yesterday every morning until the app is opened. If the
                    // snapshot month is stale, no cell matches, which is correct.
                    busy = snap.optJSONObject("busy");
                }
            }
        } catch (Exception e) {
            // Bad snapshot — render the device month with no markers.
        }

        views.setTextViewText(R.id.cal_month,
            zh ? year + "年" + month + "月" : MONTHS_EN[month - 1] + " " + year);

        // Sunday-start grid: offset = weekday of the 1st (0 = Sunday).
        Calendar first = Calendar.getInstance();
        first.clear();
        first.set(year, month - 1, 1);
        int offset = first.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY; // 0..6
        int daysInMonth = first.getActualMaximum(Calendar.DAY_OF_MONTH);

        for (int i = 0; i < CELL_IDS.length; i++) {
            int day = i - offset + 1;
            if (day < 1 || day > daysInMonth) {
                // Other-month cells stay empty.
                views.setTextViewText(CELL_IDS[i], "");
                views.setInt(CELL_IDS[i], "setBackgroundResource", 0);
                continue;
            }

            String dateKey = String.format(Locale.US, "%04d-%02d-%02d", year, month, day);
            boolean isToday = dateKey.equals(today);
            boolean isBusy = busy != null && busy.optInt(dateKey, 0) > 0;
            String num = String.valueOf(day);

            if (isToday) {
                views.setTextViewText(CELL_IDS[i], bold(num));
                views.setTextColor(CELL_IDS[i], COLOR_TODAY);
                views.setInt(CELL_IDS[i], "setBackgroundResource", R.drawable.widget_today_cell);
            } else if (isBusy) {
                views.setTextViewText(CELL_IDS[i], bold(num));
                views.setTextColor(CELL_IDS[i], COLOR_BUSY);
                views.setInt(CELL_IDS[i], "setBackgroundResource", 0);
            } else {
                views.setTextViewText(CELL_IDS[i], num);
                views.setTextColor(CELL_IDS[i], COLOR_DAY);
                views.setInt(CELL_IDS[i], "setBackgroundResource", 0);
            }
        }

        manager.updateAppWidget(appWidgetId, views);
    }
}
