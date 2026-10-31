package app.khoonemoon.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.JsResult;
import android.webkit.JsPromptResult;
import android.widget.EditText;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;

/** Local application assets run on an HTTPS origin; the backend remains Supabase. */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int FILE_REQUEST = 101;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    private boolean isLocal(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && HOST.equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getUserInfo() == null && uri.getPath() != null
                && uri.getPath().startsWith("/assets/");
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView = new WebView(this);
        webView.addJavascriptInterface(new NotificationBridge(), "KhoonemoonNotifications");
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equalsIgnoreCase(uri.getHost())) {
                    WebResourceResponse result = isLocal(uri) ? loader.shouldInterceptRequest(uri) : null;
                    return result != null ? result : new WebResourceResponse("text/plain", "UTF-8", 404,
                        "Not Found", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
                }
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocal(uri)) return false;
                if (request.isForMainFrame() && "https".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "مرورگر در دسترس نیست", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!isLocal(Uri.parse(url))) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("تأیید", (dialog, which) -> result.confirm())
                    .setNegativeButton("انصراف", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
                if (!isLocal(Uri.parse(url))) { result.cancel(); return true; }
                EditText input = new EditText(MainActivity.this);
                input.setSingleLine(true);
                input.setText(defaultValue);
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input)
                    .setPositiveButton("ذخیره", (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("انصراف", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_REQUEST); }
                catch (ActivityNotFoundException exception) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });
        if (state != null) webView.restoreState(state);
        else webView.loadUrl(HOME);
    }
    public final class NotificationBridge {
        @JavascriptInterface public boolean activate(String account) { return ReminderScheduler.activate(MainActivity.this, account); }
        @JavascriptInterface public boolean sync(String account, String rows) { return ReminderScheduler.replace(MainActivity.this, account, rows); }
        @JavascriptInterface public void clear() { ReminderScheduler.clear(MainActivity.this); }
        @JavascriptInterface public boolean enabled() {
            android.app.NotificationManager manager = (android.app.NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            boolean permission = Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            return permission && manager.areNotificationsEnabled();
        }
        @JavascriptInterface public void request() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 102);
                else {
                    Intent settings = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                    try { startActivity(settings); } catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "تنظیمات اعلان در دسترس نیست", Toast.LENGTH_SHORT).show(); }
                }
            });
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }
    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.removeJavascriptInterface("KhoonemoonNotifications");
        webView.destroy();
        super.onDestroy();
    }
}
