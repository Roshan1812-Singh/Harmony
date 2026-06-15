package com.harmony.music;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // The web app (Vercel) and API (Render) live on different domains, so the
        // auth cookies are "third-party" from the WebView's perspective. Android's
        // WebView blocks those by default, which silently breaks login. Enable them
        // so the session cookie set by the API is stored and sent like in a browser.
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);

        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }
    }
}
