package tw.dco.mnema;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Minimal bridge so the web app can force the home-screen widget to redraw right
 * after it writes a fresh snapshot to Preferences (otherwise the widget only
 * refreshes on its ~30-minute system cycle). Registered in MainActivity.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        TodayWidget.refreshAll(getContext());
        HabitsWidget.refreshAll(getContext());
        call.resolve();
    }
}
