import { highlightPathInCode, clearCanvas} from "./utils.js";

const vscode = acquireVsCodeApi();

var code = null;

var codeEl = document.getElementById("code");
codeEl.innerHTML = "";
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.style.minWidth = "100%";


function setupCanvas(){
    codeEl = document.getElementById("code");;
    let rect = codeEl.getBoundingClientRect();
    
    // Initialize Canvas
    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");
    
    canvas.height =  rect.height;
    canvas.width = rect.width;
    canvas.style.left = rect.left + "px";
    canvas.style.top = rect.top + "px";
}



// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    switch (message.command) {
        case "highlight":
            highlightPathInCode(canvas, ctx, codeEl, message.path);
            break;
        case "clear":
            clearCanvas(canvas, ctx);
            break;
        case "data":
            code = message.code;
            codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
            await new Promise(r => setTimeout(r, 100));
            setupCanvas();
            break;
        default:
            break;
    }

});
vscode.postMessage({command:"loaded"});