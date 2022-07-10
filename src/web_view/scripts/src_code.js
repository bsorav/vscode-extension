import { highlightPathInCode, clearCanvas} from "./utils.js";

var code = 
`#include <stddef.h>

size_t strlen(char *s)
{
  char *p ;
  for (p = s; *p; ++p);
  return p-s ;
}
`;


// window.addEventListener('message', async event => {
//     const messgae = event.data;
//     code = messgae.code;
//     // console.log(prod_cfg);
// });


// async function waitForMessage(){
//     // console.log(prod_cfg);
//     while(code === null){
//         await new Promise(r => window.setTimeout(r, 100));
//     }
// }

// await waitForMessage();


// Add code to webview and apply styles

let codeEl = document.getElementById("code");
codeEl.innerHTML = code;
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.classList.add("line-numbers");
preEl.style.minWidth = "100%";

await new Promise(r => setTimeout(r, 100));

codeEl = document.getElementById("code");;
let rect = codeEl.getBoundingClientRect();

// Initialize Canvas
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

canvas.height =  rect.height;
canvas.width = rect.width;
canvas.style.left = rect.left + "px";
canvas.style.top = rect.top + "px";


// Event listener for message from product graph webview
window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case "highlight":
            highlightPathInCode(canvas, ctx, codeEl, message.path);
            break;
        case "clear":
            clearCanvas(canvas, ctx);
            break;
        default:
            break;
    }

});
