import { highlightPathInCode, clearCanvas} from "./utils.js";

const vscode = acquireVsCodeApi();

var code = null;
var current_dst_codetype = "asm";

var codeEl = document.getElementById("code");
codeEl.innerHTML = "";
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.style.minWidth = "100%";

function viewVIR(evt) {
    console.log('viewVIR called');
    hideRightClickMenu();
    current_dst_codetype = "vir";
    redraw();
}
  
function viewASM(evt) {
    console.log('viewASM called');
    hideRightClickMenu();
    current_dst_codetype = "asm";
    redraw();
};

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

    document.removeEventListener('contextmenu', onRightClick);
    document.addEventListener('contextmenu', onRightClick);
}

function redraw() {
    console.log("Called redraw");
    // setupCanvas();
    // highlightPathInCode(canvas, ctx, codeEl, message.path);
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

function onRightClick(event) {
    console.log(`onRightClick called`);
    event.preventDefault();
    const { clientX: mouseX, clientY: mouseY } = event;
  
    const rightClickMenu = document.getElementById('right-click-menu');
    if (rightClickMenu.style.display != "inline") {
      showRightClickMenu(mouseX, mouseY);
    } else {
      hideRightClickMenu();
    }
}

function showRightClickMenu(mouseX, mouseY) {
    console.log("Current Code:", current_dst_codetype);
    console.log(`showRightClickMenu called`);
    const rightClickMenu = document.getElementById("right-click-menu");
    rightClickMenu.style.top = `${mouseY}px`;
    rightClickMenu.style.left = `${mouseX}px`;
  
    var items = rightClickMenu.querySelectorAll(".item");
  
    for (var i = 0; i < items.length; i++) {
    //   items[i].removeEventListener('click', downloadObjectListener);
    //   items[i].removeEventListener('click', downloadAssemblyListener);
    //   items[i].removeEventListener('click', downloadSourceListener);
    //   items[i].removeEventListener('click', downloadLLVMIRListener);
      items[i].removeEventListener('click', viewVIR);
      items[i].removeEventListener('click', viewASM);
      items[i].innerHTML = '';
    }
  
    rightClickMenu.style.display = "inline";
  
    var i = 0;
  
    if (current_dst_codetype == "asm") {
        items[i].innerHTML = 'View VIR';
        items[i].addEventListener('click', viewVIR);
        i++;
    } else if (current_dst_codetype == "vir") {
        items[i].innerHTML = 'View Assembly';
        items[i].addEventListener('click', viewASM);
        i++;
    }
       
    rightClickMenu.classList.add("visible");
  }
  
function hideRightClickMenu() {
    console.log(`hideRightClickMenu called`);
    const rightClickMenu = document.getElementById("right-click-menu");
    rightClickMenu.style.display = "none";
    rightClickMenu.classList.remove("visible");
  }
  

vscode.postMessage({command:"loaded"});