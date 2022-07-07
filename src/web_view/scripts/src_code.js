import { highlightPathInCode, clearCanvas} from "./utils.js";

const code = 
`int LEN , a [ LEN ] , b [ LEN ];
int c [ LEN ] , d [ LEN ];
void s441 () {
	for (int i = 0; i < LEN ; i ++) {
		if ( d [ i ] < 0) {
			a [ i ] += b [ i ] * c [ i ];
		} else if ( d [ i ] == 0) {
			a [ i ] += b [ i ] * b [ i ];
		} else {
			a [ i ] += c [ i ] * c [ i ];
		}
	}
}
`; 

let codeEl = document.getElementById("code");
codeEl.innerHTML = code;
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.classList.add("line-numbers");

await new Promise(r => setTimeout(r, 100));

codeEl = document.getElementById("code");;
let rect = codeEl.getBoundingClientRect();
// console.log(rect);

// // // Initialize Canvas
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

canvas.height =  rect.height;
canvas.width = rect.width;
canvas.style.left = rect.left + "px";
canvas.style.top = rect.top + "px";


// highlightPathInCode(canvas, ctx, codeEl, "((C_4_20-C_6_13-C_4_20)+(C_4_20-C_10_13-C_4_20))^4-C_13_1");

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
