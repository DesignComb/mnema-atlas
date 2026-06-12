package tw.dco.mnema;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin that lets the web app poke the home-screen widget to redraw.
        registerPlugin(WidgetBridge.class);
        // In-app APK self-update (native changes can't ship via the web OTA).
        registerPlugin(ApkInstaller.class);
        super.onCreate(savedInstanceState);
    }
}
