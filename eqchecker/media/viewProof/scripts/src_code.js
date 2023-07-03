//import { highlightPathInCode, clearCanvas} from "./utils.js";
import {Node, angleFromXAxis, coordAtDist} from "./graphics.js";
import {arrayUnique, convert_long_long_map_json_to_associative_array} from "./utils.js";
import {dst_asm_compute_index_to_line_map,tfg_llvm_obtain_subprogram_info,tfg_asm_obtain_subprogram_info,obtain_insn_arrays_from_eqcheck_info/*,get_src_dst_node_map,get_ir_node_map*/,tfg_asm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_LL_linenum_for_pc} from "./tfg.js";

const vscode = acquireVsCodeApi();

var code = null;
var ir = null;
var current_codetype = "src";
var curSyntaxType = null;
var current_highlight_message = null;

var codeEl = document.getElementById("code");
//codeEl.innerHTML = "";
codeEl.style.fontSize = "16px";

let preEl = document.getElementById("pre-code");
preEl.style.minWidth = "100%";

const entryNodeX = 1;
const defaultNodeX = 2;
const entryLabelGap = 0.5;
const exitLabelGap = 1.0;
const canvasMarginY = 20;
const canvasMaxWidth = 1024;
const minCanvasTop = 20;
const canvasTopOffset = 4;
const canvasLeftOffset = 2;

var curCanvasTop;

function setupCanvas(){
    codeEl = document.getElementById("code");;
    let rect = codeEl.getBoundingClientRect();

    // Initialize Canvas
    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    canvas.height =  rect.height;
    canvas.width = Math.min(rect.width, canvasMaxWidth);
    canvas.style.left = rect.left + "px";
    curCanvasTop = rect.top;
    canvas.style.top = curCanvasTop + "px";

    let startX, startY;

    var onMouseMove = function (event) {
      const deltaX = startX - event.clientX;
      const deltaY = startY - event.clientY;

      window.scrollBy(deltaX, deltaY);

      startX = event.clientX;
      startY = event.clientY;
    };

    canvas.addEventListener('mousedown', function(event) {
      startX = event.clientX;
      startY = event.clientY;

      hideRightClickMenu();
      document.addEventListener('mousemove', onMouseMove);
    });

    document.addEventListener('mouseup', function(event) {
      document.removeEventListener('mousemove', onMouseMove);
    });

    document.removeEventListener('contextmenu', onRightClick);
    document.addEventListener('contextmenu', onRightClick);
}

function node_convert_to_xy(pc, pc_unroll, subprogram_info, nodeMap, codetype)
{
  //let canvas = document.getElementById("canvas");
  let styles = window.getComputedStyle(document.getElementById("code"));
  let deltaY = styles.lineHeight.replace("px", "") * 1;
  let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

  //const [entryX, entryY, exitX, exitY] = [1, subprogram_info.scope_line, 1, canvas.height / deltaY];

  if (pc === 'L0%0%d' && codetype != "ir") {
    const entryY = subprogram_info === undefined ? undefined : subprogram_info.scope_line;

    return { type: "entry", pc: pc, y: entryY, x: entryNodeX };
  } else if (pc.charAt(0) === 'L') {
    if (nodeMap[pc] === undefined) {
      console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
      console.log(`pc = ${pc}`);
    }
    const linename = nodeMap[pc].linename;
    const columnname = nodeMap[pc].columnname;
    return { type: "L", pc: pc, x: columnname, y: linename, unroll: pc_unroll.unroll };
  } else {
    return { type: "exit", pc: pc };
  }
}

function edge_id_convert_to_xy(edge_id, subprogram_info, nodeMap, codetype)
{
  const from_node = node_convert_to_xy(edge_id.from_pc, 1, subprogram_info, nodeMap, codetype);
  const to_node = node_convert_to_xy(edge_id.to_pc, 1, subprogram_info, nodeMap, codetype);
  //console.log(`from_pc = ${edge_id.from_pc}, to_pc = ${edge_id.to_pc}, edge_id.is_fallthrough = ${edge_id.is_fallthrough}`);
  return { from_node: from_node, to_node: to_node, is_fallthrough: edge_id.is_fallthrough };
}

//function edge_with_unroll_convert_to_xy(ec, subprogram_info, nodeMap)
//{
//  const from_node = node_convert_to_xy(ec.from_pc, ec.from_pc_unroll, subprogram_info, nodeMap);
//  const to_node = node_convert_to_xy(ec.to_pc, ec.to_pc_unroll, subprogram_info, nodeMap);
//  return { from_node: from_node, to_node: to_node };
//}

//function getNodesEdgesFromPathAndNodeMap_recursive(ec, subprogram_info, nodeMap)
//{
//  if (ec.is_epsilon) {
//    return { is_epsilon: true, edges: [], nodes: [] };
//  }
//  var graph_ec = { is_epsilon: false, edges: [], nodes: [] };
//  switch (ec.name) {
//    case 'series':
//    case 'parallel':
//      const children = ec.serpar_child;
//      children.forEach(function (child_ec) {
//        const child_graph_ec = getNodesEdgesFromPathAndNodeMap_recursive(child_ec, subprogram_info, nodeMap);
//        graph_ec.edges = arrayUnique(graph_ec.edges.concat(child_graph_ec.edges));
//        graph_ec.nodes = arrayUnique(graph_ec.nodes.concat(child_graph_ec.nodes));
//      });
//      break;
//    case 'edge_with_unroll':
//      //console.log(`ec =\n${JSON.stringify(ec)}\n`);
//      const eu_edge = edge_with_unroll_convert_to_xy(ec, subprogram_info, nodeMap);
//      graph_ec.nodes.push(eu_edge.from_node);
//      graph_ec.nodes.push(eu_edge.to_node);
//      graph_ec.nodes = arrayUnique(graph_ec.nodes);
//      graph_ec.edges.push(eu_edge);
//      break;
//  }
//  return graph_ec;
//}


function mk_array(x) {
  if (x === undefined) return [];
  else if (Array.isArray(x)) return x;
  else return [x];
}

function add_to_nodeMap(nodeMap, codetype, pc, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map)
{
  if (nodeMap[pc] === undefined) {
    var linename, columnname, line_and_column_names, insn_pc;
    if (tfg_llvm === undefined) {
      [insn_pc, linename, columnname, line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(tfg_asm, pc, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);
    } else if (codetype == "ir") {
      [linename, columnname] = tfg_llvm_obtain_LL_linenum_for_pc(tfg_llvm, pc);
      line_and_column_names = linename + " at " + columnname;
    } else {
      [linename, columnname, line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(tfg_llvm, pc);
    }
    const entry = {pc: pc, linename: linename, columnname: columnname, line_and_column_names: line_and_column_names, insn_pc: insn_pc};
    nodeMap[pc] = entry;
  }
}

function getNodesEdgesFromPath(path, codetype, subprogram_info, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map)
{
  const edge_ids = mk_array(path.edge_id);
  if (edge_ids.length == 0) {
    return { is_epsilon: true, edges: [], nodes: [], nodeMap: {} };
  }

  var graph_ec = { is_epsilon: false, edges: [], nodes: [], nodeMap: {} };

  //if (tfg_llvm !== undefined) {
  //  console.log(`ll_filename_linenum_map = ${JSON.stringify(tfg_llvm["ll_filename_linenum_map"])}`);
  //}

  edge_ids.forEach(function (edge_id) {
    //console.log(`ec =\n${JSON.stringify(ec)}\n`);
    const from_pc = edge_id.from_pc;
    const to_pc = edge_id.to_pc;
    var linename, columnname, line_and_column_names, insn_pc;
    add_to_nodeMap(graph_ec.nodeMap, codetype, from_pc, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);
    add_to_nodeMap(graph_ec.nodeMap, codetype, to_pc, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);

    const eu_edge = edge_id_convert_to_xy(edge_id, subprogram_info, graph_ec.nodeMap, codetype);
    graph_ec.nodes.push(eu_edge.from_node);
    graph_ec.nodes.push(eu_edge.to_node);
    graph_ec.nodes = arrayUnique(graph_ec.nodes);
    graph_ec.edges.push(eu_edge);
  });
  return graph_ec;
}

function identifyFirstNodeWithCycle(path)
{
  return path.from_pc; //XXX : TODO: FIXME: find the first entry to a cycle
}

export function highlightPathInCode(canvas, ctx, codeEl, path, eqcheck_info, tfg, srcdst, codetype)
{
  if (path === undefined) {
    return;
  }
  scroll(0, 0);
  //window.scroll({left:window.scrollWidth, top:window.scrollHeight, behavior:'smooth'});
  //console.log(`highlightPathInCode: tfg=\n${JSON.stringify(tfg)}\n`);
  // canvas -> <canvas> element in HTML DOM
  // ctx -> canvas context
  // codeEl -> <code> element in HTML DOM
  // path -> graph-ec of pcs
  // pc -> line/col names

  //var EDGES = [ { from_node: {type: "entry"}, to_node: {type: "L", x: 6, y: 6} }, { from_node: {type: "L", x: 6, y: 6}, to_node: {type: "L", x: 9, y: 6} }, { from_node: {type: "L", x: 6, y: 6}, to_node: {type: "exit"} } ];
  //var NODES = [ { node: {type: "L", x: 6, y: 6}, unroll: 1 }, { node: {type: "L", x: 9, y: 6}, unroll: 1 } ];

  //console.log(`path = ${JSON.stringify(path)}`);

  const [assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map] = obtain_insn_arrays_from_eqcheck_info(eqcheck_info, srcdst);

  const tfg_llvm = tfg["tfg_llvm"];
  const tfg_asm = tfg["tfg_asm"];

  const nodes = tfg["graph"]["nodes"];

  var code_subprogram_info, ir_subprogram_info;
  if (tfg_llvm === undefined) {
    code_subprogram_info = tfg_asm_obtain_subprogram_info(tfg_asm, assembly);
  } else {
    [code_subprogram_info, ir_subprogram_info] = tfg_llvm_obtain_subprogram_info(tfg_llvm);
  }

  var is_source_code = false;
  if (tfg_llvm !== undefined && codetype != "ir") {
    is_source_code = true;
  }

  //const code_nodeMap = get_src_dst_node_map(nodes, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);
  //const ir_nodeMap = get_ir_node_map(nodes, tfg_llvm);

  //const nodeMap = (codetype == "ir") ? ir_nodeMap : code_nodeMap;
  const subprogram_info = (codetype == "ir") ? ir_subprogram_info : code_subprogram_info;

  //console.log(`highlightPathInCode: nodeMap=\n${JSON.stringify(nodeMap)}`);

  const graph_ec = getNodesEdgesFromPath(path.graph_ec_constituent_edge_list, codetype, subprogram_info, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);

  add_to_nodeMap(graph_ec.nodeMap, codetype, path.from_pc, tfg_llvm, tfg_asm, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);

  const EDGES = graph_ec.edges;
  const NODES = graph_ec.nodes;
  const nodeMap = graph_ec.nodeMap;
  const is_epsilon = graph_ec.is_epsilon;

  const from_pc_xy = node_convert_to_xy(path.from_pc, { unroll: 1 }, subprogram_info, nodeMap, codetype);

  //console.log(`highlightPathInCode codetype ${codetype}: EDGES=\n${JSON.stringify(EDGES)}\n`);

  //let scrollHeight = window.scrollHeight;
  const styles = window.getComputedStyle(codeEl);
  const deltaY = parseInt(styles.getPropertyValue("line-height"));

  codeEl = document.getElementById("code");;
  let rect = codeEl.getBoundingClientRect();

  let topNode = rect.height*1;
  let bottomNode = 0*1;

  //console.log(`path.unroll_factor_{mu,delta} = {${path.unroll_factor_mu}, ${path.unroll_factor_delta}}\n`);
  var node_with_mu_annotation;
  if (path.unroll_factor_mu != path.unroll_factor_delta.unroll) {
    node_with_mu_annotation = identifyFirstNodeWithCycle(path);
    //console.log(`node_with_mu_annotation = ${node_with_mu_annotation}\n`);
  }

  NODES.forEach(element => {
    if (!isNaN(element.y)) {
      const ypx = Math.max(0, (element.y * 1 - 5) * deltaY);
      //console.log(`ypx = ${ypx}`);
      topNode = Math.max(0, Math.min(topNode, ypx));
      bottomNode = Math.max(bottomNode, ypx);
    }
  });

  const newCanvasHeight = (bottomNode - topNode) + 2*canvasMarginY*deltaY;
  const newCanvasTop = Math.max(minCanvasTop, topNode - canvasMarginY*deltaY);
  //console.log(`deltaY = ${deltaY}, canvasMarginY = ${canvasMarginY}, bottomNode = ${bottomNode}, topNode = ${topNode}, newCanvasHeight = ${newCanvasHeight}, newCanvasTop = ${newCanvasTop}`);

  if (!isNaN(newCanvasHeight) && !isNaN(newCanvasTop)) {
    canvas.height = newCanvasHeight;
    curCanvasTop = newCanvasTop;
    canvas.style.top = curCanvasTop + "px";
  }

  if (is_epsilon) {
    drawPointOnNode(canvas, ctx, from_pc_xy, "stays still", undefined, undefined, true, true);
    return;
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
        unroll = path.unroll_factor_delta.unroll;
      }
      drawPointOnNode(canvas, ctx, element, undefined, unroll, unroll_is_only_mu, (element.pc == path.from_pc), (element.pc == path.to_pc));
      //console.log(`${element.pc}: element.y = ${element.y}, deltaY = ${deltaY} topNode = ${topNode}`);
  });

  EDGES.forEach(element => {
      drawEdgeBetweenPoints(canvas, ctx, element.from_node, element.to_node, element.is_fallthrough, is_source_code);
  });

  //console.log(`deltaY = ${deltaY} topNode = ${topNode}`);

  //window.scroll({left:window.scrollWidth, top:topNode, behavior:'smooth'});
  scroll(0, topNode);
}

function canvasRelativeY(canvas, abs_y)
{
  const ret = Math.max(0, abs_y - curCanvasTop) + canvasTopOffset;
  //console.log(`canvasRelativeY: abs_y = ${abs_y}, ret = ${ret}`);
  return ret;
}

function canvasRelativeX(canvas, abs_x)
{
  const ret = abs_x + canvasLeftOffset;
  return ret;
}



function drawArc(canvas, ctx, abs_cx, abs_cy, radius, theta1, theta2, anticlockwise, color, pattern)
{
    const cx = canvasRelativeX(canvas, abs_cx)
    const cy = canvasRelativeY(canvas, abs_cy)
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.arc(cx, cy, radius, theta1, theta2, anticlockwise);
    ctx.strokeStyle = color;
    ctx.stroke();
}


function drawArrowHead(canvas, ctx, abs_x, abs_y, theta, color) {

    const x = canvasRelativeX(canvas, abs_x)
    const y = canvasRelativeY(canvas, abs_y)

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




function drawText(canvas, ctx, abs_x, abs_y, text, size, color){
    const x = canvasRelativeX(canvas, abs_x);
    const y = canvasRelativeY(canvas, abs_y);
    ctx.fillStyle = color;
    ctx.font = size + "px Arial";
    ctx.fillText(text, x, y);
}

function drawNode(canvas, ctx, abs_x, abs_y, radius, color, is_start_pc, is_stop_pc) {
    const x = canvasRelativeX(canvas, abs_x);
    const y = canvasRelativeY(canvas, abs_y);
    ctx.beginPath();
    if (is_start_pc) {
      ctx.ellipse(x, y, radius, 3*radius, 0, 0, 2 * Math.PI);
      color = "rgb(0,255,0)";
    } else if (is_stop_pc) {
      ctx.rect(x-radius, y-radius, 2*radius, 6*radius);
      color = "rgb(0,0,0)";
    } else {
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
    }
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(canvas, ctx, abs_x1, abs_y1, abs_x2, abs_y2, color, pattern) {
    const x1 = canvasRelativeX(canvas, abs_x1);
    const x2 = canvasRelativeX(canvas, abs_x2);
    const y1 = canvasRelativeY(canvas, abs_y1);
    const y2 = canvasRelativeY(canvas, abs_y2);
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

function drawPointOnNode(canvas, ctx, node, text, unroll, unroll_is_only_mu, is_start_pc, is_stop_pc)
{
    //node = node.split("_");
    //console.log(`drawPointOnNode: node=${JSON.stringify(node)}, unroll ${unroll}\n`);
    //let canvas = document.getElementById("canvas");
    //let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

    let x1 = (node.x - 1) * 1 * deltaX;
    let y1 = node.y * 1 * deltaY - deltaY/4;

    let color;
    if(unroll > 1){
        let r = 10;
        color = "rgb(252, 3, 219)";
        drawNode(canvas, ctx, x1, y1, 3, color, is_start_pc, is_stop_pc);
        ctx.lineWidth = 1;
        drawArc(canvas, ctx, x1, y1, r, 0, 3*Math.PI/2, false, color, []);
        drawArrowHead(canvas, ctx, x1, y1-r, 0, color);
        let x = x1 + 2*r*Math.cos(Math.PI/4);
        let y = y1 - 2*r*Math.sin(Math.PI/4);
        const textcolor = "rgb(3, 3, 255)";
        var prefix_to_unroll = "";
        if (unroll_is_only_mu) {
          prefix_to_unroll = "<=";
        }
        drawText(canvas, ctx, x, y, prefix_to_unroll + unroll, 22, textcolor);
    } else {
        color = "rgb(255, 0, 0)";
        drawNode(canvas, ctx, x1, y1, 3, color, is_start_pc, is_stop_pc);
    }
    if (text !== undefined) {
      let r = 5;
      let x = x1 + r*Math.cos(7*Math.PI/4);
      let y = y1 - r*Math.sin(7*Math.PI/4);
      const textcolor = "rgb(255, 0, 0)";
      drawText(canvas, ctx, x, y, text, 10, textcolor);
    }
}



function drawEdgeBetweenPoints(canvas, ctx, node1, node2, is_fallthrough, is_source_code)
{
    // node1 is predecessor
    // node2 is successor
    // Draw edge between node1 and node2
    //console.log(`node1 = ${node1.pc}, node2 = ${node2.pc}, node1.x = ${node1.x}, node2.x = ${node2.x}, is_fallthrough = ${is_fallthrough}`);

    let pattern = [];

    //let canvas = document.getElementById("canvas");
    //let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    const delta2Y = parseInt(styles.getPropertyValue("line-height"));
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7; // 3/7 is roughly the ratio of width to height (as taken from the Internet)

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
      drawPointOnNode(canvas, ctx, label_node, "ENTRY", undefined, undefined, true, false);
    }
    if (node2.type === "exit") {
      node2.x = node1.x;
      node2.y = (node1.y*1) + exitLabelGap;
      drawPointOnNode(canvas, ctx, node2, "EXIT", undefined, undefined, false, true);
    }

    //console.log(`Drawing an edge: (${node1.type},${node1.x},${node1.y}) -> (${node2.type},${node2.x},${node2.y})`);

    let x1 = (node1.x - 1) * 1 * deltaX;
    let y1 = node1.y * 1 * deltaY - deltaY/4;
    let x2 = (node2.x - 1) * 1 * deltaX;
    let y2 = node2.y * 1 * deltaY - deltaY/4;

    let color1 = 'rgb(255, 0, 0)';
    let color2 = 'rgb(52, 58, 235, 0.8)';
    let theta = angleFromXAxis(x1, y1, x2, y2);

    //if (x1 === x2 && y1 === y2) {
    //  let radius = deltaX*3;
    //  // drawCircle(x1, y1, 2, color1);
    //  drawArc(ctx, x1 + radius, y1, radius, 0, 2*Math.PI, false, color2, pattern);
    //  drawArrowHead(ctx, x1 + 2*radius, y1, 3*Math.PI/2, color1);
    //  // drawCircle(x2, y2, 2, color1);
    //  return;
    //}

    const backward_jump = (y1 > y2 || (y1 === y2 && x1 > x2));
    const forward_jump = !backward_jump && !is_source_code && is_fallthrough != "true" && node1.x == node2.x;
    //if (forward_jump) {
    //  console.log(`forward jump for ${JSON.stringify(node1)}->${JSON.stringify(node2)}`);
    //}
    //console.log(`node1 = ${node1.pc}, node2 = ${node2.pc}, node1.x = ${node1.x}, node2.x = ${node2.x}, is_fallthrough = ${is_fallthrough}, backward_jump = ${backward_jump}, forward_jump = ${forward_jump}`);

    if (backward_jump || forward_jump) { //back jump || forward jump
        var loc, anticlockwise;
        if (backward_jump) {
          if (x1 >= x2) {
              loc = 1;
              anticlockwise = true;
          }
          else {
              loc = -1;
              anticlockwise = false;
          }
        } else {
          loc = 1
          anticlockwise = true;
        }
        var prependicular_to_theta = -1 * (x2 - x1) / (y2 - y1);

        var coord1 = {x:x1, y:y1};
        var coord2 = {x:x2, y:y2};

        var dist = Math.sqrt((coord1.x - coord2.x) ** 2 + (coord1.y - coord2.y) ** 2);

        const distance_threshold_for_drawing_arc = 30;
        const angle_between_radius_and_line_between_coords = 1.309; //between 45 and 60 degrees

        var distance_of_arc_center_from_line_center;
        if (dist < distance_threshold_for_drawing_arc) {
            distance_of_arc_center_from_line_center = 0;
        }
        else{
            distance_of_arc_center_from_line_center  = Math.tan(angle_between_radius_and_line_between_coords) * dist / 2;
        }
        var line_center = { x: (coord1.x + coord2.x) / 2, y: (coord1.y + coord2.y) / 2 };


        var arc_center = coordAtDist(line_center.x, line_center.y, prependicular_to_theta, -1 * loc * distance_of_arc_center_from_line_center);

        if (y1 === y2){
            arc_center = {x: line_center.x, y: line_center.y + loc*distance_of_arc_center_from_line_center};
        }
        if (x1 === x2 && forward_jump){
            arc_center = {x: line_center.x + loc*distance_of_arc_center_from_line_center, y: line_center.y};
        }

        //var theta1 = Math.atan((coord1.y - c2.y) / (coord1.x - c2.x));
        //var theta2 = Math.atan((coord2.y - c2.y) / (coord2.x - c2.x));
        var radius = Math.sqrt((coord1.x - arc_center.x) ** 2 + (coord1.y - arc_center.y) ** 2);

        //if (loc === -1) {
        //    theta1 = Math.PI + theta1;
        //    theta2 = Math.PI + theta2;
        //}
        var theta1 = angleFromXAxis(arc_center.x, arc_center.y, coord1.x, coord1.y);
        var theta2 = angleFromXAxis(arc_center.x, arc_center.y, coord2.x, coord2.y);

        var point_in_middle_of_arc = coordAtDist(line_center.x, line_center.y, prependicular_to_theta, loc * (radius - distance_of_arc_center_from_line_center));

        if(y1 === y2){
            point_in_middle_of_arc = {x:arc_center.x, y:(arc_center.y - radius)};
        }
        if(x1 === x2 && forward_jump){
            point_in_middle_of_arc = {x:arc_center.x - radius, y:arc_center.y};
        }


        var ntheta = angleFromXAxis(arc_center.x, arc_center.y, point_in_middle_of_arc.x, point_in_middle_of_arc.y);
        if(loc === -1){
            ntheta = Math.PI/2 + ntheta;
        }
        else{
            ntheta = ntheta - Math.PI/2;
        }

        // drawCircle(ctx, x1, y1, 2, color1);
        drawArc(canvas, ctx, arc_center.x, arc_center.y, radius, theta1, theta2, anticlockwise, color2, pattern);
        drawArrowHead(canvas, ctx, point_in_middle_of_arc.x, point_in_middle_of_arc.y, ntheta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);

    } else if (y1 <= y2) {
        // drawCircle(ctx, x1, y1, 2, color1);
        drawLine(canvas, ctx, x1, y1, x2, y2, color2, pattern);
        drawArrowHead(canvas, ctx, (x1+x2)/2, (y1+y2)/2, theta, color1);
        // drawArrowHead(ctx, x1, y1, theta, color1);
        // drawArrowHead(ctx, x2, y2, theta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);
    }
}

function redraw()
{
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");

  scroll(0, 0);
  clearCanvas(canvas, ctx);

  var codeChosen;
  if (current_codetype == "src") {
    codeChosen = code;
  } else if (current_codetype == "ir") {
    codeChosen = ir;
  }

  var codeDisplay;
  if (curSyntaxType === "asm") {
    codeDisplay = Prism.highlight(codeChosen, Prism.languages.nasm, 'nasm');
    //codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
  } else {
    codeDisplay = Prism.highlight(codeChosen, Prism.languages.clike, 'clike');
  }

  // Clear old contents
  codeEl.innerHTML = codeDisplay;
  //updateLineNumbers();
  Prism.highlightAll();

  //await new Promise(r => setTimeout(r, 100));
  setupCanvas();

  //console.log(`message.path = ${JSON.stringify(message.path)}`);
  if (current_highlight_message !== null) {
    highlightPathInCode(canvas, ctx, codeEl, current_highlight_message.path, current_highlight_message.eqcheck_info, current_highlight_message.tfg, current_highlight_message.srcdst, current_codetype);
  }
}

function updateLineNumbers() {
  const codePre = document.querySelector('pre code');
  console.log(codePre.innerText);
  const codeLines = codePre.innerText.split('\n');

  const lineCount = codeLines.length;

  // Generate line numbers and modify the code
  let codeContent = '';
  for (let i = 0; i < lineCount; i++) {
    codeContent += `<span class="line-number">${i + 1}</span>${codeLines[i]}\n`;
  }

  codePre.innerHTML = codeContent;
}

// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    switch (message.command) {
        case "highlight": {
            //console.log(`highlight called on path ${JSON.stringify(message.path)}\n`);
            current_highlight_message = { path: message.path, eqcheck_info: message.eqcheck_info, tfg: message.tfg, srcdst: message.srcdst };
            break;
        }
        case "clear": {
            current_highlight_message = null;
            break;
        }
        case "data": {
            code = message.code + "\n.";
            ir = message.ir;
            curSyntaxType = message.syntax_type;
            current_highlight_message = { path: message.path, eqcheck_info: message.eqcheck_info, tfg: message.tfg, srcdst: message.srcdst };
            break;
        }
        case "load": {
            vscode.postMessage({command:"loaded"});
            break;
        }
        default: {
            break;
        }
    }
    redraw();

});

window.addEventListener('DOMContentLoaded', (event) => {
  //updateLineNumbers();
});

vscode.postMessage({command:"loaded"});

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  console.log(`clicking element`);
  element.click();
  console.log(`clicked element`);

  document.body.removeChild(element);
}

function downloadObjectListener(evt) {
  console.log('downloadObjectListener called');
  hideRightClickMenu();
  download("object", "data");
};

function downloadAssemblyListener(evt) {
  console.log('downloadAssemblyListener called');
  hideRightClickMenu();
};

function downloadSourceListener(evt) {
  console.log('downloadSourceListener called');
  hideRightClickMenu();
};

function downloadLLVMIRListener(evt) {
  console.log('downloadLLVMIRListener called');
  hideRightClickMenu();
};

function viewIR(evt) {
  console.log('viewIR called');
  hideRightClickMenu();
  current_codetype = "ir";
  redraw();
};

function viewSourceCode(evt) {
  console.log('viewSourceCode called');
  hideRightClickMenu();
  current_codetype = "src";
  redraw();
};



function showRightClickMenu(mouseX, mouseY) {
  console.log(`showRightClickMenu called`);
  const rightClickMenu = document.getElementById("right-click-menu");
  rightClickMenu.style.top = `${mouseY}px`;
  rightClickMenu.style.left = `${mouseX}px`;

  var items = rightClickMenu.querySelectorAll(".item");

  for (var i = 0; i < 4; i++) {
    items[i].removeEventListener('click', downloadObjectListener);
    items[i].removeEventListener('click', downloadAssemblyListener);
    items[i].removeEventListener('click', downloadSourceListener);
    items[i].removeEventListener('click', downloadLLVMIRListener);
    items[i].removeEventListener('click', viewIR);
    items[i].removeEventListener('click', viewSourceCode);
    items[i].innerHTML = '';
  }

  rightClickMenu.style.display = "inline";

  var i = 0;

  if (curSyntaxType != "asm") {
    if (current_codetype == "src") {
      items[i].innerHTML = 'View IR';
      items[i].addEventListener('click', viewIR);
      i++;
    } else if (current_codetype == "ir") {
      items[i].innerHTML = 'View Source';
      items[i].addEventListener('click', viewSourceCode);
      i++;
    }
  }
  if (curSyntaxType == "asm") {
    items[i].innerHTML = 'Download Object Code';
    items[i].addEventListener('click', downloadObjectListener);
    i++;
    items[i].innerHTML = 'Download Assembly Code';
    items[i].addEventListener('click', downloadAssemblyListener);
    i++;
  } else {
    if (current_codetype == "src") {
      items[i].innerHTML = 'Download Source Code';
      items[i].addEventListener('click', downloadSourceListener);
      i++;
    } else if (current_codetype == "ir") {
      items[i].innerHTML = 'Download LLVM IR';
      items[i].addEventListener('click', downloadLLVMIRListener);
      i++;
    }
  }

  rightClickMenu.classList.add("visible");
}

function hideRightClickMenu() {
  console.log(`hideRightClickMenu called`);
  const rightClickMenu = document.getElementById("right-click-menu");
  rightClickMenu.style.display = "none";
  rightClickMenu.classList.remove("visible");
}

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

//window.addEventListener('contextmenu', event => { onRightClick(); });
