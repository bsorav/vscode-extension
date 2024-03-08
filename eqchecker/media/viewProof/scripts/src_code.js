//import { highlightPathInCode, clearCanvas} from "./utils.js";
import {Node, angleFromXAxis, coordAtDist} from "./graphics.js";
import {arrayUnique, convert_long_long_map_json_to_associative_array} from "./utils.js";
import {dst_asm_compute_index_to_line_map,tfg_llvm_obtain_subprogram_info,tfg_asm_obtain_subprogram_info,obtain_insn_arrays_from_eqcheck_info/*,get_src_dst_node_map,get_ir_node_map*/,tfg_asm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_LL_linenum_for_pc,} from "./tfg.js";

const vscode = acquireVsCodeApi();

var global_code = null;
var ir = null;
var vir = null;
var vir_obj = null;
var skip_override = null;
var vir_line_expr_map = null;
var vir_expr_line_map = null;
var obj = null;
var code_filename;
var ir_filename;
var obj_filename;
var current_codetype = "src";
var curSyntaxType = null;
var current_highlight_message = null;
var current_scroll_height = null;

var code_line_edge_map , ir_line_edge_map

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

var lastTapTime;
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
      console.log("scrolling");
      console.log(deltaY);
      current_scroll_height += deltaY;

      startX = event.clientX;
      startY = event.clientY;
    };

    // canvas.addEventListener('mousedown', function(event) {
    //   startX = event.clientX;
    //   startY = event.clientY;

    //   hideRightClickMenu();
    //   document.addEventListener('mousemove', onMouseMove);
    // });

    document.removeEventListener('click',onLeftClick);

    document.addEventListener('click', onLeftClick);

    document.addEventListener('mouseup', function(event) {
      document.removeEventListener('mousemove', onMouseMove);
    });

    document.removeEventListener('contextmenu', onRightClick);
    document.addEventListener('contextmenu', onRightClick);
}

function find_path(pc_arr, to_pc, vir_code_arr, visited) {
  console.log("find path called with ", pc_arr, to_pc);
  var pc_size = pc_arr.length;
  var points = Array.from({ length: pc_size }, () => []);
  var curr_pc;
  var j = 0;

  pc_arr.forEach(element => {
    visited.add(element);
  });

  const exhausted_paths = new Set([]);

  // Cycle through all the PCs (Perform a "BFS")
  while (j < pc_size){
    curr_pc = pc_arr[j];

    // If all paths are exhausted
    if (exhausted_paths.size == pc_size){
      return [];
    }

    // If this path is exhausted
    if (exhausted_paths.has(j)){
      j = ((j+1)%(pc_size));
      console.log("Reached the end on one path");
      continue;
    }

    if (curr_pc == "E0%d%d"){
      exhausted_paths.add(j);
      j = ((j+1)%(pc_size));
      console.log("Reached the end on one path");
      continue;
    }

    // Add the pc to the visited arr
    visited.add(curr_pc);

    var i = vir_code_arr.findIndex(function(str) {
      return str.includes("BB%" + curr_pc + " :");
    });

    if (i == -1) {
      console.log("PC not found!");
      // return {valid: false, points: points};
    }

    if (curr_pc == "L0%0%d"){
      points[j].push({x: 1, y: i+1, type:"L0%0%d"});
    } else {
      // console.log("i: ", i);
      points[j].push({x: 1, y: i+1, type:"L"})
    }

    // Reach the end of the block
    while(i < vir_code_arr.length && !(vir_code_arr[i].includes("if (")) && !(vir_code_arr[i].includes("goto"))){
      points[j].push({x: 1, y: i+1, type:"L"});
      i++;
    }

    // If reached an if_else
    if (vir_code_arr[i].includes("if (")){
      console.log("found a if statement");
      var new_pc_arr = [];
      while(vir_code_arr[i].includes("if")){
        var target_pc = vir_code_arr[i].split(" ")[3].replace("BB%","");
        // We need to check visited here since we are "committing" to this branch
        // In a DFS manner. So we must prevent infinite loops
        if (!visited.has(target_pc)){
          new_pc_arr.push(target_pc);
        }
        i++;
      }
      console.log("PC arr in if statement,", new_pc_arr);
      var path = find_path(new_pc_arr, to_pc, vir_code_arr, visited);
      if (path == []){
        exhausted_paths.add(j);
      } else {
        var final_path = points[j].concat(path);
        console.log("Final path:", final_path);
        return final_path;
      }

    }

    // Reached a goto
    // console.log("SPLITARR:", vir_code_arr[i].split(" "));
    var target_pc = vir_code_arr[i].split(" ")[1].replace("BB%","");

    // Target pc of this path is already visited
    // 2nd condition for the case of loops
    if (visited.has(target_pc) && target_pc != to_pc){
      exhausted_paths.add(j);
      j = ((j+1)%pc_size);
      console.log("target pc is already visited");
      continue;
    }

    curr_pc = target_pc;
    pc_arr[j] = curr_pc;

    if (curr_pc == to_pc){
      break;
    }

    j = ((j+1)%(pc_size));
  }

  // Find the ending PC
  var i = vir_code_arr.findIndex(function(str) {
    return str.includes("BB%" + curr_pc + " :");
  });

  points[j].push({x: 1, y: i+1, type:"L"});

  return points[j];

}

// Function to get line numbers to map for edge
// Fix this for functions with conditional branches!
function get_points_for_vir(edge){
  if (edge === undefined){
    return {valid: false, points:[]};
  }
  console.log("get_points_for_vir EDGE:", edge);

  // The from and to PCs
  const from_pc = edge.from_pc;
  const to_pc = edge.to_pc;

  // Array of VIR code
    const vir_code_arr = vir.split("\n");

    var points = [];
    // Point = {x, y, type}

    var chk1 = vir_code_arr.findIndex(function(str) {
	return str.includes("BB%" + from_pc + " :");
    });

    var chk2 = vir_code_arr.findIndex(function(str) {
	return str.includes("BB%" + to_pc + " :");
    });

    if (chk1 == -1 || chk2 == -1){
	return {valid: false, points: []};
    }

    var pc_arr = [from_pc];
    var visited = new Set([]);
  
    points = find_path(pc_arr, to_pc, vir_code_arr, visited);

    return {valid: true, points: points};

}

function get_expr_id_or_var(vir_obj, idx) {
  if (vir_obj.exprs[idx].type == "var") {
    return vir_obj.exprs[idx].val;
  } else {
    return "t" + idx.toString();
  }
}

function construct_expr_args(vir_obj, args, skipfirst){
  if (args.length == 0) return "";
  var args_str = "(";
  const startidx = skipfirst ? 1 : 0;
  for (let i = startidx; i < args.length; i ++) {
    let e = args[i];
    args_str += get_expr_id_or_var(vir_obj, e);
    if (i != args.length-1) {
      args_str += ", ";
    }
  }
  args_str += ")";
  return args_str;
}

function construct_expr(vir_obj, idx, skip){
  var vst = "t" + idx.toString() + " := ";
  if (vir_obj.exprs[idx].type == "simple") {
    vst += vir_obj.exprs[idx].op;
    vst += construct_expr_args(vir_obj, vir_obj.expr_args[idx], false);
  } else {
    if (skip[idx] == false) {
      vst += "t" + vir_obj.expr_args[idx][0].toString() + " := ";
    }
    if (vir_obj.exprs[idx].type == "donotsimplify_expr") {
      if (vir_obj.exprs[idx].op == "read_mem") {
	vst += get_expr_id_or_var(vir_obj, vir_obj.expr_args[idx][1]);
	vst += "[";
	vst += get_expr_id_or_var(vir_obj, vir_obj.expr_args[idx][2]);
	vst += "]";
      } else if (vir_obj.exprs[idx].op == "write_mem") {
	vst += get_expr_id_or_var(vir_obj, vir_obj.expr_args[idx][1]);
	vst += "[";
	vst += get_expr_id_or_var(vir_obj, vir_obj.expr_args[idx][2]);
	vst += "] = ";
	vst += get_expr_id_or_var(vir_obj, vir_obj.expr_args[idx][3]);
      } else {
	vst += vir_obj.exprs[idx].op;
	vst += construct_expr_args(vir_obj, vir_obj.expr_args[idx], true);
      }
    } else if (vir_obj.exprs[idx].type == "setflags") {
      vst += "setflags(";
      for (let i = 1; i < vir_obj.expr_args[idx].length; i ++) {
	vst += vir_obj.exprs[idx].flags[i];
	vst += " = ";
	let e = vir_obj.expr_args[idx][i];
	vst += get_expr_id_or_var(vir_obj, e);
	if (i != vir_obj.expr_args[idx].length-1) {
	  vst += ", ";
	}
      }
      vst += ")"
    } else if (vir_obj.exprs[idx].type == "donotsimplify_parith_expr") {
      vst += vir_obj.exprs[idx].op;
      vst += "_vec";
      vst += construct_expr_args(vir_obj, vir_obj.expr_args[idx], true);
    } else if (vir_obj.exprs[idx].type == "packed_float_vector") {
      vst += vir_obj.exprs[idx].op;
      vst += "_packed_float_vec";
      vst += construct_expr_args(vir_obj, vir_obj.expr_args[idx], true);
    } else if (vir_obj.exprs[idx].type == "scalar_float_vector") {
      vst += vir_obj.exprs[idx].op;
      vst += "_scalar_float_vec";
      vst += construct_expr_args(vir_obj, vir_obj.expr_args[idx], true);
    } else if (vir_obj.exprs[idx].type == "setflag_op") {
      vst += "set_";
      vst += vir_obj.exprs[idx].flag;
      vst += "_from_";
      vst += vir_obj.exprs[idx].op;
      vst += "_op"
      vst += construct_expr_args(vir_obj, vir_obj.expr_args[idx], true);
    } else {
      console.error("expr type not defined");
    }
  }
  vst += " : " + vir_obj.exprs[idx].sort;

  return vst;
}

function rec_get_expr_vir(cur_expr, done, strs, expr_nums, vir_obj, skip) {
  
  if (done[cur_expr]) {
    return;
  }
  done[cur_expr] = true;
  if (vir_obj.exprs[cur_expr].type == "var") {
    return;
  }
  let start = skip[cur_expr] ? 1 : 0;
  for (let i = start; i < vir_obj.expr_args[cur_expr].length; i ++) {
    rec_get_expr_vir(vir_obj.expr_args[cur_expr][i], done, strs, expr_nums, vir_obj, skip);
  }
  strs.push(construct_expr(vir_obj, cur_expr, skip));
  expr_nums.push(cur_expr);
}

function get_vir_from_obj(vir_obj, skip_override){
  
  var new_skip = vir_obj.can_skip.slice();
  for (let i = 0; i < new_skip.length; i ++) {
    new_skip[i] = new_skip[i] & !(skip_override[i]);
  }

  var vir = "";

  var cline = 0;

  var done = new Array(vir_obj.expr_args.length).fill(false);
  
  vir_expr_line_map = new Array(vir_obj.expr_args.length).fill(-1);

  for (let i = 0; i < vir_obj.vir.length; i ++) {
    if (vir_obj.vir[i].type == "expr") {
      let strs = [];
      let expr_nums = [];
      rec_get_expr_vir(vir_obj.vir[i].idx, done, strs, expr_nums, vir_obj, new_skip);
      for (let j = 0; j < strs.length; j ++) {
    	vir += strs[j];
    	vir_expr_line_map[expr_nums[j]] = cline;
    	var newline_count = strs[j].split("\n").length - 1;
    	cline += newline_count;
    	vir += "\n";
    	cline += 1;
      }
    } else if (vir_obj.vir[i].type == "condbr") {
      vir += "if (" + get_expr_id_or_var(vir_obj, vir_obj.vir[i].cond) + ") goto BB%" + vir_obj.vir[i].target;
      vir += "\n";
      cline += 1;
    } else if (vir_obj.vir[i].type == "branch") {
      vir += "goto BB%" + vir_obj.vir[i].target;
      vir += "\n";
      cline += 1;
    } else if (vir_obj.vir[i].type == "label") {
      if (vir_obj.vir[i].label == "L0%0%d") {
	vir += "BB%" + vir_obj.vir[i].label + " :";
	vir += "\n";
	cline += 1;
      }
      else {
	vir += "\n";
	vir += "BB%" + vir_obj.vir[i].label + " :";
	vir += "\n";
	cline += 2;
      } 
    } else if (vir_obj.vir[i].type == "phi") {
      var e = vir_obj.vir[i].exprs;
      vir += vir_obj.vir[i].val + " := PHI" + construct_expr_args(vir_obj, e, false) + " : " + vir_obj.vir[i].sort;
      vir += "\n";
      cline += 1;
    } else if (vir_obj.vir[i].type == "assgn") {
      var e = vir_obj.vir[i].exprs;
      vir += vir_obj.vir[i].val + " := " + get_expr_id_or_var(vir_obj, e) + " : " + vir_obj.vir[i].sort;
      vir += "\n";
      cline += 1;
    } else {
      console.log(vir_obj.vir[i].type);
      console.error("vir type not defined");
    }
  }

  vir_line_expr_map = new Array(cline+1).fill(-1);
  for (let i = 0; i < vir_expr_line_map.length; i ++) {
    if (vir_expr_line_map[i] != -1) {
      vir_line_expr_map[vir_expr_line_map[i]+1] = i;
    }
  }

  return vir;
  
}

function parse_vir_obj(message){
  
  vir_obj = JSON.parse(message)
  
  for (let i = 0; i < vir_obj.expr_args.length; i++) {
    if (vir_obj.expr_args[i] == "") {
      vir_obj.expr_args[i] = [];
    }
    else {
      for (let j = 0; j < vir_obj.expr_args[i].length; j ++) {
	vir_obj.expr_args[i][j] = parseInt(vir_obj.expr_args[i][j]);
      }
    }
  }

  for (let i = 0; i < vir_obj.can_skip.length; i++) {
    if (vir_obj.can_skip[i] == "0") {
      vir_obj.can_skip[i] = false;
    }
    else {
      vir_obj.can_skip[i] = true;
    }
  }

  for (let i = 0; i < vir_obj.vir.length; i++) {
    if (vir_obj.vir[i].type == "expr") {
      vir_obj.vir[i].idx = parseInt(vir_obj.vir[i].idx);
    }
    else if (vir_obj.vir[i].type == "assgn") {
      vir_obj.vir[i].exprs = parseInt(vir_obj.vir[i].exprs);
    }
    else if (vir_obj.vir[i].type == "phi") {
      for (let j = 0; j < vir_obj.vir[i].exprs.length; j ++) {
	vir_obj.vir[i].exprs[j] = parseInt(vir_obj.vir[i].exprs[j]);
      }
    }
    else if (vir_obj.vir[i].type == "condbr") {
      vir_obj.vir[i].cond = parseInt(vir_obj.vir[i].cond);
    }
  }

  return vir_obj;
}


function node_convert_to_xy(pc, pc_unroll, subprogram_info, nodeMap, codetype)
{
  //let canvas = document.getElementById("canvas");
  let styles = window.getComputedStyle(document.getElementById("code"));

  //const [entryX, entryY, exitX, exitY] = [1, subprogram_info.scope_line, 1, canvas.height / deltaY];

  if (pc === 'L0%0%d' && codetype != "ir") {
    var entryY = subprogram_info === undefined ? undefined : subprogram_info.scope_line;
    if(curSyntaxType==="asm"){
      entryY = parseInt(entryY)+1;
      entryY = entryY.toString();
    }
    return { type: "entry", pc: pc, y: entryY, x: entryNodeX };
  } else if (pc.charAt(0) === 'L') {
    if (nodeMap[pc] === undefined) {
      console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
      console.log(`pc = ${pc}`);
    }

    var linename = nodeMap[pc].linename;
    const columnname = nodeMap[pc].columnname;
    if(curSyntaxType==="asm"){
      linename = parseInt(linename)+1;
      linename=linename.toString();
    }
    //console.log(linename);
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
    //console.log(`${curSyntaxType}: returning epsilon`);
    return { is_epsilon: true, edges: [], nodes: [], nodeMap: {} };
  }

  var graph_ec = { is_epsilon: false, edges: [], nodes: [], nodeMap: {} };

  //if (tfg_llvm !== undefined) {
  //  console.log(`ll_filename_linenum_map = ${JSON.stringify(tfg_llvm["ll_filename_linenum_map"])}`);
  //}

  //console.log(`${curSyntaxType}: edge_ids = ${JSON.stringify(edge_ids)}`);
  edge_ids.forEach(function (edge_id) {
    //console.log(`ec =\n${JSON.stringify(ec)}\n`);
    const from_pc = edge_id.from_pc;
    const to_pc = edge_id.to_pc;

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


function highlightPathinVIR(canvas, ctx, codeEl, path, eqcheck_info, tfg, srcdst, edge_vir){
  if (path === undefined) {
    return;
  }
  scroll(0, 0);

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

  const styles = window.getComputedStyle(codeEl);
  const deltaY = parseInt(styles.getPropertyValue("line-height"));

  codeEl = document.getElementById("code");;
  let rect = codeEl.getBoundingClientRect();

  let topNode = rect.height*1;
  let bottomNode = 0*1;

  console.log("Getting points for vir GEN, path is: ", path);
  var res = get_points_for_vir(edge_vir);
  var points;
  if (res.valid){
    points = res.points;
  } else {
    // We are done
    return;
  }
  console.log("POINTS: ", points);

  points.forEach(element => {
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

  console.log("Reached here.");

  for (var i = 0; i < points.length; i++) {
    var unroll = 1;
    var unroll_is_only_mu = false;
    var element = points[i];
    drawPointAtCoord(canvas, ctx, element.x, element.y, undefined, unroll, unroll_is_only_mu, (i == 0), (i == points.length-1));
  }

  for (var i = 0; i < points.length-1; i++){
    var pt1 = points[i];
    var pt2 = points[i+1];

    // drawEdgeBetweenPoints(canvas, ctx, element.from_node, element.to_node, element.is_fallthrough, is_source_code);

    drawEdgeBetweenCoords(canvas, ctx, pt1, pt2, false, true);
  }

  console.log("topnode");
  console.log(topNode);

  scroll(0, topNode);
  current_scroll_height = topNode;

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
  //console.log(`nodeMap =${JSON.stringify(nodeMap)}`);
  const from_pc_xy = node_convert_to_xy(path.from_pc, { unroll: 1 }, subprogram_info, nodeMap, codetype);
  //console.log(`path.from_pc = ${JSON.stringify(path.from_pc)}; from_pc_xy = ${JSON.stringify(from_pc_xy)}`);
  NODES.push(from_pc_xy);

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

  //console.log(`${curSyntaxType}: NODES = ${JSON.stringify(NODES)}`);
  //console.log(`${curSyntaxType}: EDGES = ${JSON.stringify(EDGES)}`);
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

  var content = document.getElementById("content");
  var currentZoom = parseFloat(content.style.zoom) || 1;
  scroll(0, topNode*currentZoom);
  current_scroll_height = topNode*currentZoom;

  if (is_epsilon) {
    //console.log(`${curSyntaxType}: is_epsilon: calling drawPointOnNode with from_pc_xy = ${JSON.stringify(from_pc_xy)}`);
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

// Functions for VIR



function drawPointAtCoord(canvas, ctx, x, y, text, unroll, unroll_is_only_mu, is_start_pc, is_stop_pc)
{
    //node = node.split("_");
    //console.log(`drawPointOnNode: node=${JSON.stringify(node)}, unroll ${unroll}\n`);
    //let canvas = document.getElementById("canvas");
    //let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;

    let x1 = (x - 1) * 1 * deltaX;
    let y1 = y * 1 * deltaY - deltaY/4;

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

function drawEdgeBetweenCoords(canvas, ctx, pt1, pt2, is_fallthrough, is_source_code)
{
    // pt1 is predecessor
    // pt2 is successor
    // Draw edge between pt1 and pt2
    //console.log(`pt1 = ${pt1.pc}, pt2 = ${pt2.pc}, pt1.x = ${pt1.x}, pt2.x = ${pt2.x}, is_fallthrough = ${is_fallthrough}`);

    let pattern = [];

    //let canvas = document.getElementById("canvas");
    //let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    const delta2Y = parseInt(styles.getPropertyValue("line-height"));
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7; // 3/7 is roughly the ratio of width to height (as taken from the Internet)

    if (pt1.x === undefined) {
      pt1.x = defaultNodeX;
    }
    if (pt2.x === undefined) {
      pt2.x = defaultNodeX;
    }

    if (pt1.x === pt2.x && pt1.y === pt2.y) {
      //console.log(`Ignoring the edge: (${pt1.x},${pt1.y}) -> (${pt2.x},${pt2.y})`);
      return;
    }

    if (pt1.type === "entry") {
      var label_node = pt1;
      label_node.y = (pt1.y*1) - entryLabelGap;
      drawPointAtCoord(canvas, ctx, pt1.x, pt1.y, "ENTRY", undefined, undefined, true, false);
    }
    if (pt2.type === "exit") {
      pt2.x = pt1.x;
      pt2.y = (pt1.y*1) + exitLabelGap;
      drawPointAtCoord(canvas, ctx, pt2.x, pt2.y, "EXIT", undefined, undefined, false, true);
    }

    //console.log(`Drawing an edge: (${pt1.type},${pt1.x},${pt1.y}) -> (${pt2.type},${pt2.x},${pt2.y})`);

    let x1 = (pt1.x - 1) * 1 * deltaX;
    let y1 = pt1.y * 1 * deltaY - deltaY/4;
    let x2 = (pt2.x - 1) * 1 * deltaX;
    let y2 = pt2.y * 1 * deltaY - deltaY/4;

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
    const forward_jump = !backward_jump && !is_source_code && is_fallthrough != "true" && pt1.x == pt2.x;
    //if (forward_jump) {
    //  console.log(`forward jump for ${JSON.stringify(pt1)}->${JSON.stringify(pt2)}`);
    //}
    //console.log(`pt1 = ${pt1.pc}, pt2 = ${pt2.pc}, pt1.x = ${pt1.x}, pt2.x = ${pt2.x}, is_fallthrough = ${is_fallthrough}, backward_jump = ${backward_jump}, forward_jump = ${forward_jump}`);

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


function drawPointOnNode(canvas, ctx, node, text, unroll, unroll_is_only_mu, is_start_pc, is_stop_pc,highlight_node=false)
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

    //console.log(`x1 = ${x1}, y1 = ${y1}`);

    let color;
    if(unroll !== undefined && unroll > 1){
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
        if(highlight_node){
          color = "rgb(0,255,0)";
        }
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

function highlightNodeInCode(canvas, ctx, codeEl, node, eqcheck_info, tfg, srcdst, codetype){
  //console.log(`highlightNodeInCode: node = ${JSON.stringify(node)}`);
  if (node === undefined) {
    return;
  }
  scroll(0, 0);

  const styles = window.getComputedStyle(codeEl);
  const deltaY = parseInt(styles.getPropertyValue("line-height"));

  codeEl = document.getElementById("code");;
  let rect = codeEl.getBoundingClientRect();

  let topNode = rect.height*1;

  var ypx;
  if(codetype=="src"){
    ypx = Math.max(0, (node.linename * 1 - 5) * deltaY);
  }
  else{
    ypx = ypx = Math.max(0, (node.ir_linename * 1 - 5) * deltaY);
  }
  topNode = Math.max(0,ypx);

  const newCanvasHeight = 2*deltaY + 2*canvasMarginY*deltaY;
  const newCanvasTop = Math.max(minCanvasTop, topNode - canvasMarginY*deltaY);

  if (!isNaN(newCanvasHeight) && !isNaN(newCanvasTop)) {
    canvas.height = newCanvasHeight;
    curCanvasTop = newCanvasTop;
    canvas.style.top = curCanvasTop + "px";
  }

  var node_xy = {pc: node.pc}
  if(codetype=="src"){
    node_xy.y = node.linename;
    node_xy.x = node.columnname;
  }
  else{
    node_xy.y=node.ir_linename;
    node_xy.x = node.ir_columnname;
  }
  if(node.pc==="L0%0%d"){
    node_xy.type="entry";
    drawPointOnNode(canvas, ctx, node_xy, "ENTRY", undefined, undefined, true, false,true);
  }
  else if(node.pc.charAt(0)=='L'){
    node_xy.type == "L";
    drawPointOnNode(canvas, ctx, node_xy, node.label, undefined, undefined, false, false,true);
  }
  else{
    node_xy.type="exit";
    drawPointOnNode(canvas, ctx, node_xy, "EXIT", undefined, undefined, false, true);
  }

  var content = document.getElementById("content");
  var currentZoom = parseFloat(content.style.zoom) || 1;
  scroll(0, topNode*currentZoom);
  current_scroll_height = topNode*currentZoom;


}

function redraw()
{
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");

  scroll(0, 0);
  clearCanvas(canvas, ctx);

  //console.log(`global_code =\n${global_code.length}`);

  var codeChosen;
  if (current_codetype == "src") {
    codeChosen = global_code;
  } else if (current_codetype == "ir") {
    codeChosen = ir;
  } else if (current_codetype == "vir") {
    // console.log("VIR:", vir);
    codeChosen = vir;
  }

  var codeDisplay;
  if (curSyntaxType === "asm") {
    codeDisplay = Prism.highlight(codeChosen, Prism.languages.nasm, 'nasm');

    //codeEl.innerHTML = Prism.highlight(code, Prism.languages.clike, 'clike');
  } else {
    codeDisplay = Prism.highlight(codeChosen, Prism.languages.clike, 'clike');
  }

  // console.log("CODE TO DISPLAY:", codeChosen.split("\n"));
  // Clear old contents
  codeEl.innerHTML = codeDisplay;
  Prism.highlightAll();

  //await new Promise(r => setTimeout(r, 100));
  setupCanvas();

  //console.log("Current HL Message:", current_highlight_message);

  //console.log(`message.path = ${JSON.stringify(message.path)}`);
  if (current_highlight_message !== null) {
    if(current_highlight_message.path!==undefined){
      console.log("Going to highlight");
      if (current_codetype == "vir") {
        //console.log("Current codetype is VIR");
        highlightPathinVIR(canvas, ctx, codeEl, current_highlight_message.path, current_highlight_message.eqcheck_info, current_highlight_message.tfg, current_highlight_message.srcdst, current_highlight_message.vir_edge);
      } else {
        highlightPathInCode(canvas, ctx, codeEl, current_highlight_message.path, current_highlight_message.eqcheck_info, current_highlight_message.tfg, current_highlight_message.srcdst, current_codetype);
      }
    }
    else{
      highlightNodeInCode(canvas, ctx, codeEl, current_highlight_message.node, current_highlight_message.eqcheck_info, current_highlight_message.tfg, current_highlight_message.srcdst, current_codetype);
        //console.log("node recieved="+JSON.stringify(current_highlight_message));
    }
  }
  if (current_scroll_height !== null) {
    scroll(0, current_scroll_height);
  }
}

function addToArrayDistinct(arr,value){
  for(var i=0;i<arr.length;i++){
    if(arr[i]===value){
      return;
    }
  }
  arr.push(value);
}

function constructEdgeLineMap(edges,eqcheck_info,tfg,srcdst){

  var code_el_map = {},ir_el_map = {};
  const [assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map] = obtain_insn_arrays_from_eqcheck_info(eqcheck_info, srcdst);
  const tfg_llvm = tfg["tfg_llvm"];
  const tfg_asm = tfg["tfg_asm"];
  var code_subprogram_info, ir_subprogram_info;
  if (tfg_llvm === undefined) {
    code_subprogram_info = tfg_asm_obtain_subprogram_info(tfg_asm, assembly);
  } else {
    [code_subprogram_info, ir_subprogram_info] = tfg_llvm_obtain_subprogram_info(tfg_llvm);
  }

  var nodeMap = {};

  function add_node_to_nodeMap(pc){
    var code_line,ir_line;
    if(pc=='L0%0%d'){
      code_line = code_subprogram_info === undefined ? undefined : code_subprogram_info.scope_line;
       if(curSyntaxType==="asm"){
        code_line = parseInt(code_line)+1;
        code_line = code_line.toString();
       }
    }
    else{
      if (tfg_llvm === undefined)
      {
        const  [insn_pc, linename, columnname, line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(tfg_asm, pc, assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map);
        code_line = linename;
        code_line = parseInt(code_line)+1;
        code_line = code_line.toString();
      }
      else{
        const [linename, columnname, line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(tfg_llvm, pc);
        code_line = linename;
      }
    }
    if(tfg_llvm !==undefined){
      const [linename_ir, columnname_ir] = tfg_llvm_obtain_LL_linenum_for_pc(tfg_llvm, pc);
      ir_line = linename_ir;
    }
    nodeMap[pc] = {code_line: code_line, ir_line : ir_line};
  }

  function add_edge_to_line_list(pc, key,exit=false){
    var codeLine = nodeMap[pc].code_line;
    if(exit){
      codeLine= parseInt(codeLine)+1;
      codeLine = codeLine.toString();
    }
    if(code_el_map[codeLine]===undefined){
      code_el_map[codeLine] = {edges:[key],index: 0};
    }
    else{
      addToArrayDistinct(code_el_map[codeLine].edges,key);
    }


    if(tfg_llvm !=undefined){
      var irLine = nodeMap[pc].ir_line;
      if(exit){
        irLine= parseInt(irLine)+1;
        irLine = irLine.toString();
      }
      if(ir_el_map[irLine]===undefined){
        ir_el_map[irLine] = {edges:[key],index: 0};
      }
      else{
        addToArrayDistinct(ir_el_map[irLine].edges,key);
      }
    }
  }

  for (let key in edges) {
    const path= edges[key].edge;
    const edge_ids = mk_array(path.graph_ec_constituent_edge_list.edge_id);
    if (edge_ids.length === 0) {
      var pc = path.from_pc;
      if(nodeMap[pc]===undefined){
        add_node_to_nodeMap(pc);
      }
      add_edge_to_line_list(pc,key);

    }
    else{
      for(var i=0;i<edge_ids.length;i++){
        var from_pc = edge_ids[i].from_pc;
        var to_pc = edge_ids[i].to_pc;

        if(nodeMap[from_pc]===undefined){
          add_node_to_nodeMap(from_pc,key);
        }
        add_edge_to_line_list(from_pc,key);

        if(to_pc.charAt(0)!=='L'){
          add_edge_to_line_list(from_pc,key,true);
        }
        else{
          if(nodeMap[to_pc]===undefined){
            add_node_to_nodeMap(to_pc);
          }
          add_edge_to_line_list(from_pc,key);
        }
      }
    }

  }

  if(tfg_llvm!==undefined){
    return [code_el_map,ir_el_map];
  }

  return [code_el_map,undefined];

}

// Event listener for message from product graph webview
window.addEventListener('message', async event => {
    const message = event.data; // The JSON data our extension sent

    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");

    console.log(`codetype ${current_codetype} syntaxtype ${curSyntaxType}: command = ${message.command}`);
    switch (message.command) {
        case "highlight": {
            //console.log(`highlight called on path ${JSON.stringify(message.path)}\n`);
            if(message.node_edge==="edge"){
              current_highlight_message = { path: message.path, eqcheck_info: message.eqcheck_info, tfg: message.tfg, srcdst: message.srcdst, vir_edge : message.edge_vir };
              console.log("VIR EDGE:", current_highlight_message.vir_edge);
            }
            else{
              current_highlight_message = { node: message.node, eqcheck_info: message.eqcheck_info, tfg: message.tfg, srcdst: message.srcdst };
            }
            break;
        }
        case "clear": {
            current_highlight_message = null;
            break;
        }
        case "data": {
            global_code = message.code + "\n.";
            ir = message.ir;
            vir_obj = parse_vir_obj(message.vir);
	    skip_override = new Array(vir_obj.expr_args.length).fill(false);
	    console.log(vir_obj);
	    vir = get_vir_from_obj(vir_obj, skip_override);
	    console.log(vir);
	    console.log(vir_line_expr_map);
            obj = message.obj;
            code_filename = message.code_filename;
            ir_filename = message.ir_filename;
            obj_filename = message.obj_filename;
            curSyntaxType = message.syntax_type;
            current_highlight_message = { path: message.path, eqcheck_info: message.eqcheck_info, tfg: message.tfg, srcdst: message.srcdst };
            [code_line_edge_map,ir_line_edge_map]=constructEdgeLineMap(message.edges,message.eqcheck_info,message.tfg,message.srcdst);
            // console.log("codeLinesEdgeMap = "+ JSON.stringify(code_line_edge_map));
            // console.log("irLinesEdgeMap = "+ JSON.stringify(ir_line_edge_map));
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
    //console.log(`codetype ${current_codetype} syntaxtype ${curSyntaxType}: command = ${message.command} redraw start`);
    redraw();
    //console.log(`codetype ${current_codetype} syntaxtype ${curSyntaxType}: command = ${message.command} redraw done`);
});


vscode.postMessage({command:"loaded"});


function downloadObjectListener(evt) {
  console.log('downloadObjectListener called');
  if(obj !==undefined){
    vscode.postMessage({command:"download",type:"obj",content:obj,filename: obj_filename});
  }
  hideRightClickMenu();

};

function downloadAssemblyListener(evt) {
  console.log('downloadAssemblyListener called');
  if(global_code !==undefined){
    vscode.postMessage({command:"download",type:"asm",content:global_code,filename: code_filename});
  }
  hideRightClickMenu();
};


async function downloadSourceListener(evt) {
  console.log('downloadSourceListener called');
  if(global_code !==undefined){
    vscode.postMessage({command:"download",type:"source",content:global_code, filename: code_filename});
  }
  hideRightClickMenu();
};

function downloadLLVMIRListener(evt) {
  console.log('downloadLLVMIRListener called');
  if(ir!==undefined){
    vscode.postMessage({command:"download",type:"llvmIr",content: ir,filename: ir_filename});
  }
  hideRightClickMenu();
};

function viewIR(evt) {
  console.log('viewIR called');
  hideRightClickMenu();
  current_codetype = "ir";
  vscode.postMessage({command:"switch_codetype",codetype:"ir"});
  redraw();
};

function viewVIR(evt) {
  console.log('viewVIR called');
  hideRightClickMenu();
  current_codetype = "vir";
  redraw();
}

function viewSourceCode(evt) {
  console.log('viewSourceCode called');
  hideRightClickMenu();
  current_codetype = "src";
  vscode.postMessage({command:"switch_codetype",codetype:"src"});
  redraw();

};

function showRightClickMenu(mouseX, mouseY) {
  console.log(`showRightClickMenu called`);
  const rightClickMenu = document.getElementById("right-click-menu");
  rightClickMenu.style.top = `${mouseY}px`;
  rightClickMenu.style.left = `${mouseX}px`;

  var items = rightClickMenu.querySelectorAll(".item");

  for (var i = 0; i < items.length; i++) {
    items[i].removeEventListener('click', downloadObjectListener);
    items[i].removeEventListener('click', downloadAssemblyListener);
    items[i].removeEventListener('click', downloadSourceListener);
    items[i].removeEventListener('click', downloadLLVMIRListener);
    items[i].removeEventListener('click', viewIR);
    items[i].removeEventListener('click', viewSourceCode);
    items[i].innerHTML = '';
  }

  rightClickMenu.style.display = "inline";

  items[0].style.display ="block";
  items[1].style.display ="block";
  items[2].style.display ="block";
  items[3].style.display ="block";

  var i = 0;

  if (curSyntaxType != "asm") {
    if (current_codetype == "src") {
      items[i].innerHTML = 'View IR';
      items[i].addEventListener('click', viewIR);
      i++;
    } else if ((current_codetype == "ir") || (current_codetype == "vir")) {
      items[i].innerHTML = 'View Source';
      items[i].addEventListener('click', viewSourceCode);
      i++;
      items[i].innerHTML = 'View IR';
      items[i].addEventListener('click', viewIR);
      i++;
    }
  }

  if (current_codetype != "vir") {
    items[i].innerHTML = 'View VIR';
    items[i].addEventListener('click', viewVIR);
    i++;
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
  while(i<4){
    items[i].style.display = "none";
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

function onLeftClick(event){
  console.log("left-clicked");

  codeEl = document.getElementById("code");
  var lineHeight = window.getComputedStyle(codeEl).getPropertyValue('line-height');
  lineHeight=lineHeight.replace('px', '');
  lineHeight = parseInt(lineHeight);
  lineHeight = parseFloat(lineHeight).toFixed(2);

  var scrollY = window.scrollY-23; // -23 to adjust the padding at top
  const { clientX: mouseX, clientY: mouseY } = event;
  var lineNumber = Math.ceil((mouseY+scrollY) / lineHeight);
  lineNumber = lineNumber.toString();



  if(current_codetype==="src"){
    if(code_line_edge_map[lineNumber]===undefined){
        vscode.postMessage({command:"show_line",edge:undefined});
    }
    else{
      var index=code_line_edge_map[lineNumber].index
      vscode.postMessage({command:"show_line",edge: code_line_edge_map[lineNumber].edges[index]});
      if(index === code_line_edge_map[lineNumber].edges.length-1){
        code_line_edge_map[lineNumber].index =0;
      }
      else{
        code_line_edge_map[lineNumber].index++;
      }
    }
  }
  else if(current_codetype==="ir"){
    if(ir_line_edge_map[lineNumber]===undefined){
      vscode.postMessage({command:"show_line",edge:undefined});
    }
    else{
      var index=ir_line_edge_map[lineNumber].index
      vscode.postMessage({command:"show_line",edge: ir_line_edge_map[lineNumber].edges[index]});
      if(index === ir_line_edge_map[lineNumber].edges.length-1){
        ir_line_edge_map[lineNumber].index =0;
      }
      else{
        ir_line_edge_map[lineNumber].index++;
      }
    }

  }
  else if (current_codetype==="vir"){
    console.log("Vir lineNumber");
    console.log(lineNumber);
    console.log(vir_line_expr_map[lineNumber]);
    
    const styles = window.getComputedStyle(codeEl);
    const deltaY = parseInt(styles.getPropertyValue("line-height"));
    var currentZoom = parseFloat(content.style.zoom) || 1;

    // var current_line_delta = lineNumber - current_scroll_height / (currentZoom*deltaY);
    var pcsh = window.scrollY;
    // console.log("cvals");
    // console.log(current_line_delta);
    // console.log(current_scroll_height / (currentZoom*deltaY));
    
    var expr_num = vir_line_expr_map[lineNumber];
    if (expr_num != -1) {
      skip_override[expr_num] = !skip_override[expr_num];
      if (vir_obj.can_skip[expr_num]) {
	vir = get_vir_from_obj(vir_obj, skip_override);
	redraw();
	scroll(0, pcsh);
	current_scroll_height = pcsh;
	// scroll(0, (current_line_delta + vir_expr_line_map[expr_num])*currentZoom*deltaY);
	// current_scroll_height = (current_line_delta + vir_expr_line_map[expr_num])*currentZoom*deltaY;
      }
    }
  }

}



//window.addEventListener('contextmenu', event => { onRightClick(); });
