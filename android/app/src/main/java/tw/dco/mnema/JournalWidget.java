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

import org.json.JSONObject;

/**
 * Dark journal widget: today's mood, energy and a snippet of the entry. Reads
 * the snapshot the web app wrote (SharedPreferences "CapacitorStorage", key
 * "widget_journal"). Tapping anywhere deep-links to tw.dco.mnema://journal,
 * which the web app routes to the journal screen. Refreshes on the ~30-min
 * cycle and via WidgetBridge.
 */
public class JournalWidget extends AppWidgetProvider {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_journal";

    /** mood 1..5 → emoji. */
    private static final String[] MOODS = { "😞", "😕", "😐", "🙂", "😄" };
    private static final String[] MONTHS_EN = {
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateWidget(context, manager, id);
    }

    /** Called by WidgetBridge so a fresh snapshot shows immediately. */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, JournalWidget.class))) {
            updateWidget(context, manager, id);
        }
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    /** "2026-06-12" → "6月12日" / "Jun 12" ("" if unparsable). */
    private static String formatDate(boolean zh, String iso) {
        try {
            String[] parts = iso.split("-");
            int month = Integer.parseInt(parts[1]);
            int day = Integer.parseInt(parts[2]);
            if (month < 1 || month > 12 || day < 1 || day > 31) return "";
            return zh ? month + "月" + day + "日" : MONTHS_EN[month - 1] + " " + day;
        } catch (Exception e) {
            return "";
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.journal_widget);

        boolean zh = WidgetLang.isZh(context);
        views.setTextViewText(R.id.journal_title, zh ? "日記" : "Journal");

        // Whole card → deep link to the journal screen (web side routes the URL).
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("tw.dco.mnema://journal"));
        open.setPackage(context.getPackageName());
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.journal_root,
            PendingIntent.getActivity(context, appWidgetId * 16, open, flags()));

        boolean hasSnapshot = false;
        boolean hasEntry = false;
        String date = "";
        String snippet = "";
        int mood = -1;   // -1 = absent/null
        int energy = -1; // -1 = absent/null

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                hasSnapshot = true;
                JSONObject snap = new JSONObject(raw);
                date = snap.optString("date", "");
                hasEntry = snap.optBoolean("has_entry", false);
                if (!snap.isNull("mood")) mood = snap.optInt("mood", -1);
                if (!snap.isNull("energy")) energy = snap.optInt("energy", -1);
                snippet = snap.optString("snippet", "");
            }
        } catch (Exception e) {
            // Bad/missing snapshot — fall through to the empty state.
        }

        views.setTextViewText(R.id.journal_date, formatDate(zh, date));

        if (!hasSnapshot) {
            views.setTextViewText(R.id.journal_mood, "✍️");
            views.setTextViewText(R.id.journal_empty, zh ? "開啟 Mnema 以同步日記" : "Open Mnema to sync your journal");
            views.setViewVisibility(R.id.journal_empty, View.VISIBLE);
            views.setViewVisibility(R.id.journal_energy, View.GONE);
            views.setViewVisibility(R.id.journal_snippet, View.GONE);
        } else if (!hasEntry) {
            views.setTextViewText(R.id.journal_mood, "✍️");
            views.setTextViewText(R.id.journal_empty, zh ? "今天還沒寫日記 — 點我開始" : "No entry yet today — tap to write");
            views.setViewVisibility(R.id.journal_empty, View.VISIBLE);
            views.setViewVisibility(R.id.journal_energy, View.GONE);
            views.setViewVisibility(R.id.journal_snippet, View.GONE);
        } else {
            views.setTextViewText(R.id.journal_mood,
                (mood >= 1 && mood <= 5) ? MOODS[mood - 1] : "📔");
            views.setViewVisibility(R.id.journal_empty, View.GONE);

            if (energy >= 1) {
                StringBuilder bolts = new StringBuilder();
                int n = Math.min(energy, 5);
                for (int i = 0; i < n; i++) bolts.append("⚡");
                views.setTextViewText(R.id.journal_energy, bolts.toString());
                views.setViewVisibility(R.id.journal_energy, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.journal_energy, View.GONE);
            }

            if (snippet != null && !snippet.trim().isEmpty()) {
                views.setTextViewText(R.id.journal_snippet, snippet.trim());
                views.setViewVisibility(R.id.journal_snippet, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.journal_snippet, View.GONE);
            }
        }

        manager.updateAppWidget(appWidgetId, views);
    }
}
