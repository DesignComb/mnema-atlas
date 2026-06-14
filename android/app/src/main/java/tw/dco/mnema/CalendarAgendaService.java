package tw.dco.mnema;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Backs the calendar widget's two scrollable agenda lists (代辦 to-dos + 打卡
 * habits) for the selected day. The factory re-reads the `widget_calendar`
 * snapshot + the per-widget selected date from SharedPreferences on every
 * onDataSetChanged (fired by notifyAppWidgetViewDataChanged), so completing a
 * to-do, checking in a habit, or selecting another day all refresh in place —
 * no need to open the app. Each row carries a fill-in intent (task/habit id);
 * the list's PendingIntent template routes it to TaskActionReceiver /
 * HabitActionReceiver.
 */
public class CalendarAgendaService extends RemoteViewsService {
    static final String EXTRA_LIST = "list_type"; // "todo" | "habit"

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int widgetId = intent.getIntExtra(CalendarWidget.EXTRA_WIDGET, AppWidgetManager.INVALID_APPWIDGET_ID);
        boolean habits = "habit".equals(intent.getStringExtra(EXTRA_LIST));
        return new AgendaFactory(getApplicationContext(), widgetId, habits);
    }

    static final class Row {
        String id, title, time;
        boolean checked, actionable;
    }

    static final class AgendaFactory implements RemoteViewsFactory {
        private final Context context;
        private final int widgetId;
        private final boolean habits;
        private final List<Row> rows = new ArrayList<>();

        AgendaFactory(Context context, int widgetId, boolean habits) {
            this.context = context;
            this.widgetId = widgetId;
            this.habits = habits;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            rows.clear();
            try {
                SharedPreferences prefs = context.getSharedPreferences(CalendarWidget.PREFS, Context.MODE_PRIVATE);
                String raw = prefs.getString(CalendarWidget.KEY, null);
                if (raw == null) return;
                JSONObject snap = new JSONObject(raw);
                Calendar now = Calendar.getInstance();
                String today = String.format(Locale.US, "%04d-%02d-%02d",
                    now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
                String sel = CalendarWidget.selectedDate(prefs, widgetId);
                boolean isToday = sel.equals(today);
                boolean zh = WidgetLang.isZh(context);

                JSONObject days = snap.optJSONObject("days");
                JSONObject day = days != null ? days.optJSONObject(sel) : null;

                if (habits) {
                    Set<String> checked = new HashSet<>();
                    if (day != null) {
                        JSONArray hc = day.optJSONArray("hc");
                        if (hc != null) for (int i = 0; i < hc.length(); i++) checked.add(hc.optString(i, ""));
                    }
                    JSONArray hs = snap.optJSONArray("habits");
                    if (hs != null) {
                        for (int i = 0; i < hs.length(); i++) {
                            JSONObject h = hs.optJSONObject(i);
                            if (h == null) continue;
                            Row r = new Row();
                            r.id = h.optString("id", "");
                            r.title = h.optString("title", "");
                            int streak = h.optInt("streak", 0);
                            r.time = streak > 0 ? "🔥" + streak : "";
                            r.checked = checked.contains(r.id);
                            r.actionable = isToday; // toggle_check_in is reset-aware today-only
                            rows.add(r);
                        }
                    }
                } else {
                    JSONArray todos = day != null ? day.optJSONArray("todos") : null;
                    if (todos != null) {
                        for (int i = 0; i < todos.length(); i++) {
                            JSONObject it = todos.optJSONObject(i);
                            if (it == null) continue;
                            Row r = new Row();
                            r.id = it.optString("id", "");
                            r.title = it.optString("title", "");
                            String hm = it.optString("hm", "");
                            boolean allDay = hm.isEmpty() || "null".equals(hm);
                            r.time = allDay ? (zh ? "全天" : "All-day") : hm;
                            r.checked = false;
                            r.actionable = true;
                            rows.add(r);
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }

        @Override
        public void onDestroy() {
            rows.clear();
        }

        @Override
        public int getCount() {
            return rows.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_agenda_item);
            if (position < 0 || position >= rows.size()) return rv;
            Row r = rows.get(position);

            rv.setImageViewResource(R.id.item_check,
                r.checked ? R.drawable.ic_widget_check_filled : R.drawable.ic_widget_check);
            if (r.time == null || r.time.isEmpty()) {
                rv.setViewVisibility(R.id.item_time, android.view.View.GONE);
            } else {
                rv.setViewVisibility(R.id.item_time, android.view.View.VISIBLE);
                rv.setTextViewText(R.id.item_time, r.time);
                rv.setTextColor(R.id.item_time, habits ? 0xFFF2C18D : 0xFF8AA0FF);
            }
            rv.setTextViewText(R.id.item_title, r.title);
            rv.setTextColor(R.id.item_title, r.checked ? 0xFF9A9AA6 : 0xFFE8E8EE);

            if (r.actionable && r.id != null && !r.id.isEmpty()) {
                Intent fill = new Intent();
                if (habits) {
                    fill.putExtra(HabitActionReceiver.EXTRA_HABIT_ID, r.id);
                    fill.putExtra(HabitActionReceiver.EXTRA_CHECKED, r.checked);
                } else {
                    fill.putExtra(TaskActionReceiver.EXTRA_TASK_ID, r.id);
                }
                rv.setOnClickFillInIntent(R.id.item_root, fill);
            } else {
                // Not actionable (e.g. a habit on a past day) — tap does nothing.
                rv.setOnClickFillInIntent(R.id.item_root, new Intent());
            }
            return rv;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
