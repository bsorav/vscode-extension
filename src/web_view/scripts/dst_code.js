import { highlightPathInCode, clearCanvas} from "./utils.js";

let code = 
`s441 :
    r1 = 0
        xmm1 = a [ r1 .. r1 +3]
        xmm2 = xmm1 + b [ r1 .. r1 +3]* c [ r1 .. r1 +3]
        xmm3 = xmm1 + b [ r1 .. r1 +3]* b [ r1 .. r1 +3]
        xmm4 = xmm1 + c [ r1 .. r1 +3]* c [ r1 .. r1 +3]

        xmm0 = ( d [ r1 ] < 0) , .. , ( d [ r1 +3] < 0)
        xmm1 = xmm0 ? xmm2 : xmm1 // pblendvb

        xmm0 = ( d [ r1 ] == 0) , .. , ( d [ r1 +3] == 0)
        xmm1 = xmm0 ? xmm3 : xmm1 // pblendvb

        xmm0 = ( d [ r1 ] > 0) , .. , ( d [ r1 +3] > 0)
        xmm1 = xmm0 ? xmm4 : xmm1 // pblendvb
        a [ r1 .. r1 +3] = xmm1
        r1 += 4
        if ( r1 != LEN ) goto A3
    ret`;


let codeEl = document.getElementById("code");
codeEl.innerHTML = code;
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.classList.add("line-numbers");
preEl.style.height = window.innerHeight;

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