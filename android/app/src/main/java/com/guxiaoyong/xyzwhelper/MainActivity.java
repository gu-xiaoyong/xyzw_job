package com.guxiaoyong.xyzwhelper;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;


public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST = 1001;

    // 站点地址:更换部署地址时只改这一行
    private static final String START_URL =
            "https://xyzw-web-helper-vxfgnesj.edgeone.cool/?eo_token=706ed109a551594d12be419a03201aea&eo_time=1791859768";

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooserCallback;
    private boolean askedForNewLink = false;

    private String currentStartUrl() {
        return getSharedPreferences("config", MODE_PRIVATE)
                .getString("custom_url", START_URL);
    }

    private void askForFreshAccessLink() {
        if (askedForNewLink) return;
        askedForNewLink = true;
        runOnUiThread(() -> {
            if (isFinishing() || webView == null) return;
            EditText input = new EditText(this);
            input.setSingleLine(true);
            input.setHint("粘贴控制台“预览”生成的完整链接");
            input.setText(currentStartUrl());
            new AlertDialog.Builder(this)
                    .setTitle("访问令牌已过期")
                    .setMessage("EdgeOne 默认域名的访问链接约 3 小时过期。\n"
                            + "1. 打开 EdgeOne 控制台进入本项目\n"
                            + "2. 点击“预览”按钮生成新链接并复制\n"
                            + "3. 粘贴到下面确认即可继续使用")
                    .setView(input)
                    .setCancelable(false)
                    .setPositiveButton("确认", (dialog, which) -> {
                        String url = input.getText().toString().trim();
                        if (url.startsWith("http")) {
                            getSharedPreferences("config", MODE_PRIVATE)
                                    .edit().putString("custom_url", url).apply();
                            askedForNewLink = false;
                            webView.loadUrl(url);
                        } else {
                            askForFreshAccessLink();
                        }
                    })
                    .setNegativeButton("退出", (dialog, which) -> finish())
                    .show();
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setFitsSystemWindows(true);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        // 令牌 bin / 登录状态保存在 IndexedDB 与 localStorage,必须开启
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);
        cookies.flush();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
                if (scheme.equals("http") || scheme.equals("https")) {
                    String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
                    // 与当前页同源(含子域)留在 WebView,其余交给系统浏览器
                    Uri current = Uri.parse(view.getUrl() == null ? START_URL : view.getUrl());
                    String currentHost = current.getHost() == null ? "" : current.getHost().toLowerCase();
                    return !(host.equals(currentHost) || host.endsWith("." + currentHost));
                }
                // weixin:// 等自定义 scheme 交给系统处理
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                    WebResourceResponse errorResponse) {
                // 主框架 401 = 默认域名访问令牌过期,引导粘贴控制台新生成的链接
                if (request.isForMainFrame() && errorResponse.getStatusCode() == 401) {
                    askForFreshAccessLink();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()
                        && error.getErrorCode() == WebViewClient.ERROR_BAD_URL) {
                    askForFreshAccessLink();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (pendingFileChooserCallback != null) {
                    pendingFileChooserCallback.onReceiveValue(null);
                }
                pendingFileChooserCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    pendingFileChooserCallback = null;
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                if (userAgent != null) {
                    req.addRequestHeader("User-Agent", userAgent);
                }
                String cookie = cookies.getCookie(url);
                if (cookie != null) {
                    req.addRequestHeader("Cookie", cookie);
                }
                req.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                String name = "xyzw-helper-download.bin";
                if (contentDisposition != null) {
                    java.util.regex.Matcher m = java.util.regex.Pattern
                            .compile("filename\\*=UTF-8''([^;]+)")
                            .matcher(contentDisposition);
                    if (m.find()) {
                        name = Uri.decode(m.group(1));
                    }
                }
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(req);
                }
            } catch (Exception ignored) {
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(currentStartUrl());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            ValueCallback<Uri[]> callback = pendingFileChooserCallback;
            pendingFileChooserCallback = null;
            if (callback != null) {
                callback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
