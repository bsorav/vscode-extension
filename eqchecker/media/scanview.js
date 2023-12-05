const vscode = acquireVsCodeApi();

var reportEl = document.getElementById("report");
reportEl.innerHTML = "";
reportEl.style.fontSize = "16px";

// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case "scanviewReport": {
          //console.log(`scanviewReport received in scanview panel with url ${message.url}`);
          reportEl.innerHTML = `<a href=${message.url}>${message.url}</a>`;
        }
        default: {
            break;
        }
    }
});
vscode.postMessage({command:"loaded"});
