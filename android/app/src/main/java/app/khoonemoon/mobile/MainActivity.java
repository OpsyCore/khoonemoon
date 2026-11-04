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
    private static final int EXPORT_REQUEST = 103;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingRecoveryCode;
    private byte[] pendingExport;
    private java.io.ByteArrayOutputStream pendingBinaryExport;

    private boolean isLocal(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && HOST.equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getUserInfo() == null && uri.getPath() != null
                && uri.getPath().startsWith("/assets/");
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        captureRecoveryIntent(getIntent());
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
    // A PKCE code alone is not a session: the verifier remains in this app's
    // WebView storage. Never load an external deep link in the WebView.
    private synchronized void captureRecoveryIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"app.khoonemoon.mobile".equals(uri.getScheme()) ||
            !"recovery".equals(uri.getHost()) || uri.getPort() != -1 || uri.getUserInfo() != null ||
            (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath())) ||
            uri.getFragment() != null || uri.getQueryParameters("code").size() != 1) return;
        String code = uri.getQueryParameter("code");
        if (code != null && code.matches("[A-Za-z0-9_-]{1,512}")) pendingRecoveryCode = code;
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureRecoveryIntent(intent);
    }
    public final class NotificationBridge {
        @JavascriptInterface public String takeRecoveryCode() {
            synchronized (MainActivity.this) {
                String code = pendingRecoveryCode;
                pendingRecoveryCode = null;
                return code;
            }
        }
        @JavascriptInterface public boolean activate(String account) {
            synchronized (BackgroundCredential.class) {
                if (account == null) return false;
                org.json.JSONObject existing = BackgroundCredential.get(MainActivity.this);
                if (existing != null && !account.equals(existing.optString("account"))) {
                    ReminderSyncWorker.cancel(MainActivity.this);
                    BackgroundCredential.clear(MainActivity.this);
                }
                return ReminderScheduler.activate(MainActivity.this, account);
            }
        }
        @JavascriptInterface public String backgroundCredential(String account) {
            synchronized (BackgroundCredential.class) {
                if (!ReminderScheduler.isAccount(MainActivity.this, account)) return null;
                org.json.JSONObject credential = BackgroundCredential.getOrCreate(MainActivity.this, account);
                return credential == null ? null : credential.toString();
            }
        }
        @JavascriptInterface public boolean startBackground(String account, String id) {
            synchronized (BackgroundCredential.class) {
                if (!BackgroundCredential.isCurrent(MainActivity.this, id, account) || !ReminderScheduler.isAccount(MainActivity.this, account)) return false;
                ReminderSyncWorker.enable(MainActivity.this);
                return true;
            }
        }
        @JavascriptInterface public String stopBackground() {
            synchronized (BackgroundCredential.class) {
                org.json.JSONObject existing = BackgroundCredential.get(MainActivity.this);
                String id = existing == null ? null : existing.optString("id", null);
                ReminderSyncWorker.cancel(MainActivity.this);
                BackgroundCredential.clear(MainActivity.this);
                return id;
            }
        }
        @JavascriptInterface public boolean sync(String account, String rows) { return ReminderScheduler.replace(MainActivity.this, account, rows); }
        @JavascriptInterface public void clear() {
            synchronized (BackgroundCredential.class) {
                ReminderSyncWorker.cancel(MainActivity.this);
                BackgroundCredential.clear(MainActivity.this);
                ReminderScheduler.clear(MainActivity.this);
            }
        }
        @JavascriptInterface public boolean saveExport(String name, String mime, String content) {
            if (name == null || !name.matches("khoonemoon-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.(json|csv)") ||
                !("application/json".equals(mime) || "text/csv".equals(mime)) || content == null) return false;
            byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (bytes.length > 8 * 1024 * 1024) return false;
            synchronized (MainActivity.this) {
                if (pendingExport != null || pendingBinaryExport != null) return false;
                pendingExport = bytes;
            }
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime).putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(intent, EXPORT_REQUEST);
                } catch (ActivityNotFoundException e) {
                    synchronized (MainActivity.this) { pendingExport = null; }
                    Toast.makeText(MainActivity.this, "ذخیره فایل در دسترس نیست", Toast.LENGTH_LONG).show();
                }
            });
            return true;
        }
        @JavascriptInterface public boolean beginBinaryExport() {
            synchronized (MainActivity.this) {
                if (pendingExport != null || pendingBinaryExport != null) return false;
                pendingBinaryExport = new java.io.ByteArrayOutputStream();
                return true;
            }
        }
        @JavascriptInterface public boolean appendBinaryExport(String base64) {
            if (base64 == null || base64.length() > 50000) return false;
            synchronized (MainActivity.this) {
                if (pendingBinaryExport == null) return false;
                try {
                    byte[] part = android.util.Base64.decode(base64, android.util.Base64.NO_WRAP);
                    if (pendingBinaryExport.size() + part.length > 16 * 1024 * 1024 + 64) return false;
                    pendingBinaryExport.write(part);
                    return true;
                } catch (Exception error) { return false; }
            }
        }
        @JavascriptInterface public void cancelBinaryExport() {
            synchronized (MainActivity.this) { pendingBinaryExport = null; }
        }
        @JavascriptInterface public boolean finishBinaryExport(String name) {
            if (name == null || !name.matches("khoonemoon-(member-)?[0-9]{4}-[0-9]{2}-[0-9]{2}\\.(zip|kbackup)")) return false;
            synchronized (MainActivity.this) {
                if (pendingBinaryExport == null || pendingExport != null) return false;
                pendingExport = pendingBinaryExport.toByteArray(); pendingBinaryExport = null;
            }
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(name.endsWith(".zip") ? "application/zip" : "application/octet-stream").putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(intent, EXPORT_REQUEST);
                } catch (ActivityNotFoundException error) {
                    synchronized (MainActivity.this) { pendingExport = null; }
                    Toast.makeText(MainActivity.this, "ذخیره فایل در دسترس نیست", Toast.LENGTH_LONG).show();
                }
            });
            return true;
        }
        @JavascriptInterface public String versionName() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception ignored) { return ""; }
        }
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
        if (requestCode == EXPORT_REQUEST) {
            byte[] bytes;
            synchronized (this) { bytes = pendingExport; pendingExport = null; }
            Uri target = data == null ? null : data.getData();
            if (resultCode == RESULT_OK && target != null && bytes == null) {
                Toast.makeText(this, "فایل آماده نیست؛ دوباره خروجی بگیرید", Toast.LENGTH_LONG).show();
            }
            if (resultCode == RESULT_OK && target != null && bytes != null) {
                new Thread(() -> {
                    boolean saved = false;
                    try (java.io.OutputStream out = getContentResolver().openOutputStream(target, "w")) {
                        if (out != null) { out.write(bytes); out.flush(); saved = true; }
                    } catch (Exception ignored) { }
                    final boolean success = saved;
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, success ? "فایل ذخیره شد" : "ذخیره فایل ناموفق بود", Toast.LENGTH_LONG).show());
                }).start();
            }
            return;
        }
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
