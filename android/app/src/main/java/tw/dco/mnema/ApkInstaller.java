package tw.dco.mnema;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Environment;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * In-app APK self-update: downloads the new build via DownloadManager (visible
 * system notification = progress UI for free), then fires the package-installer
 * sheet through the app's FileProvider. Android verifies the signature matches
 * the installed app, so data survives the update like any normal app update.
 * The user grants "install unknown apps" once, the first time.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstaller extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        Context context = getContext();
        try {
            final File dest = new File(
                context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "mnema-update.apk");
            if (dest.exists() && !dest.delete()) {
                call.reject("could not clear previous download");
                return;
            }

            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setMimeType("application/vnd.android.package-archive");
            req.setTitle("Mnema");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
            req.setDestinationUri(Uri.fromFile(dest));

            DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            final long downloadId = dm.enqueue(req);

            BroadcastReceiver onComplete = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    long done = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (done != downloadId) return;
                    try {
                        ctx.getApplicationContext().unregisterReceiver(this);
                    } catch (Exception ignored) {
                    }
                    try {
                        Uri apk = FileProvider.getUriForFile(
                            ctx, ctx.getPackageName() + ".fileprovider", dest);
                        Intent installIntent = new Intent(Intent.ACTION_VIEW);
                        installIntent.setDataAndType(apk, "application/vnd.android.package-archive");
                        installIntent.addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        ctx.startActivity(installIntent);
                    } catch (Exception ignored) {
                        // The DownloadManager notification stays as a manual fallback.
                    }
                }
            };
            // EXPORTED: ACTION_DOWNLOAD_COMPLETE arrives from the system Downloads app.
            ContextCompat.registerReceiver(context.getApplicationContext(), onComplete,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_EXPORTED);

            call.resolve();
        } catch (Exception e) {
            call.reject("download failed: " + e.getMessage());
        }
    }
}
