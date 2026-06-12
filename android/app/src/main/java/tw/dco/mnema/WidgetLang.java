package tw.dco.mnema;

import android.content.Context;

/**
 * Widget localization helper (A6). The web app writes the current UI language
 * into Capacitor Preferences (SharedPreferences "CapacitorStorage", key
 * "widget_lang"). Any value starting with "zh" → Chinese; anything else →
 * English; missing/unreadable → Chinese (the widgets' historical behavior).
 */
public final class WidgetLang {

    static final String PREFS = "CapacitorStorage";
    static final String KEY = "widget_lang";

    private WidgetLang() {}

    public static boolean isZh(Context context) {
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            if (raw == null) return true;
            // Defensive: tolerate a JSON-quoted value ("zh-TW") as well as a raw one.
            String lang = raw.trim();
            if (lang.length() >= 2 && lang.startsWith("\"") && lang.endsWith("\"")) {
                lang = lang.substring(1, lang.length() - 1).trim();
            }
            if (lang.isEmpty()) return true;
            return lang.startsWith("zh");
        } catch (Exception e) {
            return true;
        }
    }

    public static String tr(Context context, String en, String zh) {
        return isZh(context) ? zh : en;
    }
}
