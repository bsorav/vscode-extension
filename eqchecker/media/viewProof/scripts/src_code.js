//import { highlightPathInCode, clearCanvas} from "./utils.js";
import {Node, angleFromXAxis, coordAtDist} from "./graphics.js";
import {arrayUnique} from "./utils.js";

const vscode = acquireVsCodeApi();

var code = null;

var codeEl = document.getElementById("code");
codeEl.innerHTML = "";
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.style.minWidth = "100%";

const entryNodeX = 1;
const defaultNodeX = 2;
const entryLabelGap = 0.5;
const exitLabelGap = 1.0;

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

    let startX, startY;

    var onMouseMove = function (event) {
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      window.scrollBy(deltaX, deltaY);

      startX = event.clientX;
      startY = event.clientY;
    };

    canvas.addEventListener('mousedown', function(event) {
      startX = event.clientX;
      startY = event.clientY;

      document.addEventListener('mousemove', onMouseMove);
    });

    document.addEventListener('mouseup', function(event) {
      document.removeEventListener('mousemove', onMouseMove);
    });
}

function node_convert_to_xy(pc, pc_unroll, subprogram_info, nodeMap)
{
  let canvas = document.getElementById("canvas");
  let styles = window.getComputedStyle(document.getElementById("code"));
  let deltaY = styles.lineHeight.replace("px", "") * 1;
  let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

  //const [entryX, entryY, exitX, exitY] = [1, subprogram_info.scope_line, 1, canvas.height / deltaY];

  if (pc === 'L0%0%d') {
    const entryY = subprogram_info.scope_line;

    return { type: "entry", pc: pc, y: entryY, x: entryNodeX };
  } else if (pc.charAt(0) === 'L') {
    const linename = nodeMap[pc].linename;
    const columnname = nodeMap[pc].columnname;
    return { type: "L", pc: pc, x: columnname, y: linename, unroll: pc_unroll.unroll };
  } else {
    return { type: "exit", pc: pc };
  }
}

function edge_with_unroll_convert_to_xy(ec, subprogram_info, nodeMap)
{
  const from_node = node_convert_to_xy(ec.from_pc, ec.from_pc_unroll, subprogram_info, nodeMap);
  const to_node = node_convert_to_xy(ec.to_pc, ec.to_pc_unroll, subprogram_info, nodeMap);
  return { from_node: from_node, to_node: to_node };
}

function getNodesEdgesFromPathAndNodeMap_recursive(ec, subprogram_info, nodeMap)
{
  if (ec.is_epsilon) {
    return { is_epsilon: true, edges: [], nodes: [] };
  }
  var graph_ec = { is_epsilon: false, edges: [], nodes: [] };
  switch (ec.name) {
    case 'series':
    case 'parallel':
      const children = ec.serpar_child;
      children.forEach(function (child_ec) {
        const child_graph_ec = getNodesEdgesFromPathAndNodeMap_recursive(child_ec, subprogram_info, nodeMap);
        graph_ec.edges = arrayUnique(graph_ec.edges.concat(child_graph_ec.edges));
        graph_ec.nodes = arrayUnique(graph_ec.nodes.concat(child_graph_ec.nodes));
      });
      break;
    case 'edge_with_unroll':
      //console.log(`ec =\n${JSON.stringify(ec)}\n`);
      const eu_edge = edge_with_unroll_convert_to_xy(ec, subprogram_info, nodeMap);
      graph_ec.nodes.push(eu_edge.from_node);
      graph_ec.nodes.push(eu_edge.to_node);
      graph_ec.nodes = arrayUnique(graph_ec.nodes);
      graph_ec.edges.push(eu_edge);
      break;
  }
  return graph_ec;
}

function getNodesEdgesFromPathAndNodeMap(path, subprogram_info, nodeMap)
{
  var graph_ec = getNodesEdgesFromPathAndNodeMap_recursive(path, subprogram_info, nodeMap);
  return graph_ec;
}

function identifyFirstNodeWithCycle(path)
{
  return path.from_pc; //XXX : TODO: FIXME: find the first entry to a cycle
}

export function highlightPathInCode(canvas, ctx, code, path, subprogram_info, nodeMap)
{
  // canvas -> <canvas> element in HTML DOM
  // ctx -> canvas context
  // code -> <code> element in HTML DOM
  // path -> graph-ec of pcs
  // pc -> line/col names

  //var EDGES = [ { from_node: {type: "entry"}, to_node: {type: "L", x: 6, y: 6} }, { from_node: {type: "L", x: 6, y: 6}, to_node: {type: "L", x: 9, y: 6} }, { from_node: {type: "L", x: 6, y: 6}, to_node: {type: "exit"} } ];
  //var NODES = [ { node: {type: "L", x: 6, y: 6}, unroll: 1 }, { node: {type: "L", x: 9, y: 6}, unroll: 1 } ];

  //console.log(`path = ${JSON.stringify(path)}`);

  const graph_ec = getNodesEdgesFromPathAndNodeMap(path.ec, subprogram_info, nodeMap);
  const EDGES = graph_ec.edges;
  const NODES = graph_ec.nodes;
  const is_epsilon = graph_ec.is_epsilon;
  const from_pc_xy = node_convert_to_xy(path.from_pc, { unroll: 1 }, subprogram_info, nodeMap);

  if (is_epsilon) {
    drawPointOnNode(from_pc_xy, "stays still", undefined, undefined);
    return;
  }

  EDGES.forEach(element => {
      drawEdgeBetweenPoints(element.from_node, element.to_node/*, element.dashed*/);
  });

  //let scrollHeight = window.scrollHeight;
  const styles = window.getComputedStyle(code);
  const deltaY = parseInt(styles.getPropertyValue("line-height"));

  let topNode = canvas.height*1;

  console.log(`path.unroll_factor_{mu,delta} = {${path.unroll_factor_mu}, ${path.unroll_factor_delta}}\n`);
  var node_with_mu_annotation;
  if (path.unroll_factor_mu != path.unroll_factor_delta) {
    node_with_mu_annotation = identifyFirstNodeWithCycle(path);
    console.log(`node_with_mu_annotation = ${node_with_mu_annotation}\n`);
  }

  NODES.forEach(element => {
      //var unroll_mu = 1;
      var unroll = 1;
      var unroll_is_only_mu = false;
      //console.log(`element.pc = ${element.pc}, path.to_pc = ${path.to_pc}\n`);
      if (element.pc === node_with_mu_annotation) {
        unroll = path.unroll_factor_mu;
        unroll_is_only_mu = true;
      } else if (element.pc === path.to_pc) {
        //unroll_mu = path.unroll_factor_mu;
        unroll = path.unroll_factor_delta;
      }
      drawPointOnNode(element, undefined, unroll, unroll_is_only_mu);
      topNode = Math.min(topNode, Math.max(0, (element.y * 1 - 5) * deltaY));
  });

  window.scroll({left:window.scrollWidth, top:topNode, behavior:'smooth'});
}

function drawText(ctx, x, y, text, size, color){
    ctx.fillStyle = color;
    ctx.font = size + "px Arial";
    ctx.fillText(text, x, y);
}

function drawCircle(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2, color, pattern) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.stroke();
}

export function clearCanvas(canvas, ctx){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawPointOnNode(node, text, unroll, unroll_is_only_mu)
{
    //node = node.split("_");
    console.log(`drawPointOnNode: node=${JSON.stringify(node)}, unroll ${unroll}\n`);
    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

    let x1 = (node.x - 1) * 1 * deltaX;
    let y1 = node.y * 1 * deltaY - deltaY/4;

    let color;
    if(unroll > 1){
        let r = 10;
        color = "rgb(252, 3, 219)";
        drawCircle(ctx, x1, y1, 3, color);
        ctx.lineWidth = 1;
        drawArc(ctx, x1, y1, r, 0, 3*Math.PI/2, false, color, []);
        drawArrowHead(ctx, x1, y1-r, 0, color);
        let x = x1 + 2*r*Math.cos(Math.PI/4);
        let y = y1 - 2*r*Math.sin(Math.PI/4);
        const textcolor = "rgb(3, 3, 255)";
        var prefix_to_unroll = "";
        if (unroll_is_only_mu) {
          prefix_to_unroll = "<=";
        }
        drawText(ctx, x, y, prefix_to_unroll + unroll, 22, textcolor);
    } else {
        color = "rgb(255, 0, 0)";
        drawCircle(ctx, x1, y1, 3, color);
    }
    if (text !== undefined) {
      let r = 5;
      let x = x1 + r*Math.cos(7*Math.PI/4);
      let y = y1 - r*Math.sin(7*Math.PI/4);
      const textcolor = "rgb(255, 0, 0)";
      drawText(ctx, x, y, text, 10, textcolor);
    }
}



function drawEdgeBetweenPoints(node1, node2/*, dashed*/)
{
    // node1 is predecessor
    // node2 is successor
    // Draw edge between node1 and node2

    let pattern = [];

    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    const delta2Y = parseInt(styles.getPropertyValue("line-height"));
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

    if (node1.x === undefined) {
      node1.x = defaultNodeX;
    }
    if (node2.x === undefined) {
      node2.x = defaultNodeX;
    }

    if (node1.x === node2.x && node1.y === node2.y) {
      //console.log(`Ignoring the edge: (${node1.x},${node1.y}) -> (${node2.x},${node2.y})`);
      return;
    }

    if (node1.type === "entry") {
      var label_node = node1;
      label_node.y = (node1.y*1) - entryLabelGap;
      drawPointOnNode(label_node, "ENTRY", undefined, undefined);
    }
    if (node2.type === "exit") {
      node2.x = node1.x;
      node2.y = (node1.y*1) + exitLabelGap;
      drawPointOnNode(node2, "EXIT", undefined, undefined);
    }

    //console.log(`Drawing an edge: (${node1.type},${node1.x},${node1.y}) -> (${node2.type},${node2.x},${node2.y})`);

    let x1 = (node1.x - 1) * 1 * deltaX;
    let y1 = node1.y * 1 * deltaY - deltaY/4;
    let x2 = (node2.x - 1) * 1 * deltaX;
    let y2 = node2.y * 1 * deltaY - deltaY/4;

    let color1 = 'rgb(255, 0, 0)';
    let color2 = 'rgb(52, 58, 235, 0.8)';
    let theta = angleFromXAxis(x1, y1, x2, y2);

    if (x1 === x2 && y1 === y2) {
      let radius = deltaX*3;
      // drawCircle(x1, y1, 2, color1);
      drawArc(ctx, x1 + radius, y1, radius, 0, 2*Math.PI, false, color2, pattern);
      drawArrowHead(ctx, x1 + 2*radius, y1, 3*Math.PI/2, color1);
      // drawCircle(x2, y2, 2, color1);
      return;
    }

    if (y1 > y2 || (y1 === y2 && x1 > x2)) {
        if (x1 >= x2) {
            var loc = 1;
            var anticlockwise = true;
        }
        else {
            var loc = -1;
            var anticlockwise = false;
        }
        var m1 = -1 * (x2 - x1) / (y2 - y1);

        var coord1 = {x:x1, y:y1};
        var coord2 = {x:x2, y:y2};

        var dist = Math.sqrt((coord1.x - coord2.x) ** 2 + (coord1.y - coord2.y) ** 2);
        if(dist < 30){
            dist = 0;
        }
        else{
            dist = Math.tan(1.309) * dist / 2;
        }
        var c1 = { x: (coord1.x + coord2.x) / 2, y: (coord1.y + coord2.y) / 2 };


        var c2 = coordAtDist(c1.x, c1.y, m1, -1 * loc * dist);

        if(y1 === y2){
            c2 = {x: c1.x, y: c1.y + loc*dist};
        }

        var theta1 = Math.atan((coord1.y - c2.y) / (coord1.x - c2.x));
        var theta2 = Math.atan((coord2.y - c2.y) / (coord2.x - c2.x));
        var r = Math.sqrt((coord1.x - c2.x) ** 2 + (coord1.y - c2.y) ** 2);

        if (loc === -1) {
            theta1 = Math.PI + theta1;
            theta2 = Math.PI + theta2;
        }
        theta1 = angleFromXAxis(c2.x, c2.y, coord1.x, coord1.y);
        theta2 = angleFromXAxis(c2.x, c2.y, coord2.x, coord2.y);

        var p = coordAtDist(c1.x, c1.y, m1, loc * (r - dist));

        if(y1 === y2){
            p = {x:c2.x, y:(c2.y - r)};
        }

        var ntheta = angleFromXAxis(c2.x, c2.y, p.x, p.y);
        if(loc === -1){
            ntheta = Math.PI/2 + ntheta;
        }
        else{
            ntheta = ntheta - Math.PI/2;
        }

        // drawCircle(ctx, x1, y1, 2, color1);
        drawArc(ctx, c2.x, c2.y, r, theta1, theta2, anticlockwise, color2, pattern);
        drawArrowHead(ctx, p.x, p.y, ntheta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);

    } else if (y1 <= y2) {
        // drawCircle(ctx, x1, y1, 2, color1);
        drawLine(ctx, x1, y1, x2, y2, color2, pattern);
        drawArrowHead(ctx, (x1+x2)/2, (y1+y2)/2, theta, color1);
        // drawArrowHead(ctx, x1, y1, theta, color1);
        // drawArrowHead(ctx, x2, y2, theta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);
    }
}

function drawArc(ctx, cx, cy, radius, theta1, theta2, anticlockwise, color, pattern)
{
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.arc(cx, cy, radius, theta1, theta2, anticlockwise);
    ctx.strokeStyle = color;
    ctx.stroke();
}


function drawArrowHead(ctx, x, y, theta, color) {

    let h = 10;
    let w = 8;

    let dir = Math.tan(theta);
    let normal = -1 / dir;

    if(theta <= Math.PI/2 || theta > Math.PI * 3/2){
        var back = -1;
    }
    else{
        var back = 1;
    }


    let baseCen = coordAtDist(x, y, dir, back * h/2);
    let baseStart = coordAtDist(x, y, dir, -1 * back * h/2);

    let coord1 = coordAtDist(baseCen.x, baseCen.y, normal, w/2);
    let coord2 = coordAtDist(baseCen.x, baseCen.y, normal, -1 * w/2);


    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(coord1.x, coord1.y);
    ctx.lineTo(coord2.x, coord2.y);
    ctx.lineTo(baseStart.x, baseStart.y);
    ctx.fill();
    ctx.closePath();
}



// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    switch (message.command) {
        case "highlight":
            highlightPathInCode(canvas, ctx, codeEl, message.path, message.subprogram_info, message.nodeMap);
            break;
        case "clear":
            clearCanvas(canvas, ctx);
            break;
        case "data":
            code = message.code;
            //console.log(`code = ${code}\n`);
            //codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
            if (message.syntax_type === "asm") {
              codeEl.innerHTML = Prism.highlight(code, Prism.languages.nasm, 'nasm');
              //codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
            } else {
              codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
            }
            await new Promise(r => setTimeout(r, 100));
            setupCanvas();
            break;
        default:
            break;
    }

});
vscode.postMessage({command:"loaded"});
