const vscode = acquireVsCodeApi();

var reportEl = document.getElementById("report");
reportEl.innerHTML = "HELLO";
reportEl.style.fontSize = "16px";

// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case "scan": {
          reportEl.innerHTML = message.report;
        }
        default: {
            break;
        }
    }
});
