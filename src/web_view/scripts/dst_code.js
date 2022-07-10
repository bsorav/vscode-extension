import { highlightPathInCode, clearCanvas} from "./utils.js";

var code = 
`#include <stddef.h>
#include <limits.h>

size_t strlen(char * str)
{
  char *ptr ;
  unsigned long *longword_ptr;
  unsigned long longword, himagic, lomagic;
  for (ptr = str; ((unsigned long)ptr & sizeof(unsigned long)) != 0; ++ptr)
    if (*ptr == '\0')
      return ptr-str ;
  longword_ptr = (unsigned long*)ptr ;
#if ULONG_MAX == 0xFFFFFFFFFFFFFFFF
  himagic = 0x8080808080808080L;
  lomagic = 0x0101010101010101L;
#else
  himagic = 0x80808080L;
  lomagic = 0x01010101L;
#endif
  for (;;)
  {
    longword = *longword_ptr++;
    if ((longword - lomagic) & ~longword & himagic) {
      char *cp = (char *)(longword_ptr - 1);
      if (cp[0] == 0) return cp - str ;
      if (cp[1] == 0) return cp - str + 1;
      if (cp[2] == 0) return cp - str + 2;
      if (cp[3] == 0) return cp - str + 3;
      if (cp[4] == 0) return cp - str + 4;
      if (cp[5] == 0) return cp - str + 5;
      if (cp[6] == 0) return cp - str + 6;
      if (cp[7] == 0) return cp - str + 7;
    }
  }
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


let codeEl = document.getElementById("code");
codeEl.innerHTML = code;
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.classList.add("line-numbers");
preEl.style.minWidth = "100%";

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