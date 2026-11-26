import SwiftUI
import WebKit

struct CrmShell: View {
    var body: some View {
        CrmWebView()
            .ignoresSafeArea()
    }
}

struct CrmWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.customUserAgent = (view.value(forKey: "userAgent") as? String ?? "") + " RupeeOneApp"
        view.load(URLRequest(url: URL(string: "https://crm.rupeedial.com/auth")!))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let host = url.host ?? ""
            if url.scheme == "tel" || url.scheme == "mailto" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            let inside = host == "crm.rupeedial.com" || host.hasSuffix(".razorpay.com") || host == "razorpay.com"
            if inside || navigationAction.targetFrame != nil {
                decisionHandler(.allow)
                return
            }
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }
}
