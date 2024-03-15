/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG
*/

import {arrayUnique, convert_long_long_map_json_to_associative_array} from "./utils.js";
import {dst_asm_compute_index_to_line_map,tfg_llvm_obtain_subprogram_info,tfg_asm_obtain_subprogram_info,obtain_insn_arrays_from_eqcheck_info,tfg_asm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_LL_linenum_for_pc,get_assembly_inum} from "./tfg.js";
// import { graphviz } from 'd3-graphviz';
// import * as d3 from 'd3';

const vscode = acquireVsCodeApi();

var g_prodCfg = null;
var g_invars = null;
var g_expr_inv_idx_map = null;
var g_invar_counter = 0;
var g_inv_idx = 0;

//var g_nodeMap = null;
var g_nodeIdMap = null;
var g_nodePCMap = null;
var g_edgeMap = null;
var g_src_tfg = null;
var g_dst_tfg = null;
var selected_edge = null;
var selected_node = null;
var g_eqcheck_info = null;
var g_src_edge_map = {};
var g_dst_edge_map = {};

var src_codetype="src";
var dst_codetype="src";

var selected_invars = null;

function parse_invars_obj(invars_obj){
  for (var loc in invars_obj) {
    if (loc == "name") {
      continue;
    }
    if (loc == "exprs_list") {
      continue;
    }
    //console.log(`loc = ${JSON.stringify(loc)}`);
    //console.log(`invars_obj[loc] = ${JSON.stringify(invars_obj[loc])}`);
    for (var inv_type in invars_obj[loc]) {
      if (inv_type == "name") {
        continue;
      }
      //console.log(`inv_type = ${JSON.stringify(inv_type)}`);
      for (var i = 0; i < invars_obj[loc][inv_type].length; i ++) {
        //console.log(`invars_obj[loc][inv_type] = ${JSON.stringify(invars_obj[loc][inv_type])}`);
        invars_obj[loc][inv_type][i].lhs = parseInt(invars_obj[loc][inv_type][i].lhs);
        invars_obj[loc][inv_type][i].rhs = parseInt(invars_obj[loc][inv_type][i].rhs);
      }
    }
  }
  for (var i = 0; i < invars_obj.exprs_list.length; i ++) {
    if (invars_obj.exprs_list[i].type == "expr") {
      for (var j = 0; j < invars_obj.exprs_list[i].args.length; j ++) {
        invars_obj.exprs_list[i].args[j] = parseInt(invars_obj.exprs_list[i].args[j]);
      }
    }
  }
  return invars_obj;
}

window.addEventListener('message', async event => {
    const message = event.data;
    //console.log(`RECEIVED EVENT: ${JSON.stringify(message)}\n`);
    switch (message.command) {
      case 'showProof':
        g_prodCfg = message.code;
        //console.log(`invars_obj = ${JSON.stringify(message.invars_obj)}`);
        g_invars = parse_invars_obj(message.invars_obj.invariants);
        g_expr_inv_idx_map = new Array(g_invars.exprs_list.length).fill(-1);
        //console.log("RECEIVED showProof. refreshing panel\n");
        refreshPanel();
        // var debug_str = String(counter++);
        // document.getElementById('debug').innerText = debug_str;
        //prod_cfg = message;
        //console.log(`prod_cfg = ${prod_cfg}`);
        break;
      case "load":
        vscode.postMessage({command:"loaded"});
        break;
      case "switch_codetype":
        if(message.srcdst==="src"){
          src_codetype = message.codetype;
        }
        else if(message.srcdst==="dst"){
          dst_codetype === message.codetype;
        }
        refreshPanel();
        break;
      case "show_line":
        var edgeId= message.edge;
        const [from_pc,to_pc] = edgeId.split(" -> ");
        const from_id = toString(g_nodePCMap[from_pc].idx);
        const to_id = toString(g_nodePCMap[to_pc].idx);
        const from = g_nodeIdMap[from_id];
        const to = g_nodeIdMap[to_id];

        selected_edge = edgeId;
        selected_node = null;
        const edge = g_edgeMap[edgeId];
        //console.log(`highlighting product-CFG edge:\nto = ${JSON.stringify(to)}\nfrom = ${JSON.stringify(from)}\nedge = ${JSON.stringify(edge)}\n`);
        vscode.postMessage({
          command:"highlight",
          node_edge:"edge",
          from: from,
          to: to,
          edge: edge,
          eqcheck_info: g_eqcheck_info,
          src_tfg: g_src_tfg,
          dst_tfg: g_dst_tfg
        });
        drawNetwork(g_prodCfg);
        break;
    }
});

//async function waitForMessage(){
//    while(g_prodCfg === null){
//        //console.log("prod_cfg is still NULL");
//        await new Promise(r => window.setTimeout(r, 1000));
//    }
//}
vscode.postMessage({command:"loaded"});

function build_expr_rec(idx, is_first_rec, inv_var_list){
  if (g_invars.exprs_list[idx].type == "var") {
    return g_invars.exprs_list[idx].val;
  }
  // add special cases for select, bvextract
  var exp = "";
  exp += g_invars.exprs_list[idx].op + "(";
  for (var i = 0; i < g_invars.exprs_list[idx].args.length; i ++) {
    var arg = g_invars.exprs_list[idx].args[i];
    if (g_expr_inv_idx_map[arg] != -1) {
      exp += "z" + g_expr_inv_idx_map[arg].toString();
    }
    else if (g_invars.exprs_list[arg].type == "src") {
      exp += "st" + g_invars.exprs_list[arg].idx.toString();
    }
    else if (g_invars.exprs_list[arg].type == "dst") {
      exp += "dt" + g_invars.exprs_list[arg].idx.toString();
    }
    else if (g_invars.exprs_list[arg].type == "var") {
      exp += g_invars.exprs_list[arg].val;
    }
    else {
      build_expr_rec(arg, false, inv_var_list, g_expr_inv_idx_map);
      exp += "z" + g_expr_inv_idx_map[arg].toString();
    }
    if (i != g_invars.exprs_list[idx].args.length-1) {
      exp += ", ";
    }
  }
  exp += ")";
  if (!is_first_rec) {
    exp = "z" + g_invar_counter.toString() + " := " + exp + " : " + g_invars.exprs_list[idx].sort;
    g_expr_inv_idx_map[idx] = g_invar_counter;
    g_invar_counter += 1;
    inv_var_list.push(exp);
  }
  return exp;
}

function build_invars(invars){
  var invarr = [];
  for (var i = 0; i < invars.length; i ++) {
    var inv = invars[i];
    var inv_var_list = [];
    var exp1 = build_expr_rec(inv.lhs, true, inv_var_list);
    var exp2 = build_expr_rec(inv.rhs, true, inv_var_list);
    var invstr = "";
    for (var j = 0; j < inv_var_list.length; j ++) {
      invstr += inv_var_list[j] + "\n";
    }
    invstr += exp1 + " " + inv.op + " "  + exp2 + " : " + inv.sort;
    invarr.push(invstr);
  }
  return invarr;
}

function get_invariants_at_pc(pc){
  console.log("Searching for PC", pc);
  // Currently only capturing BV EQ invariants
  
  return build_invars(g_invars[pc]['BV_EQ']);
}

//console.log("Waiting for proof\n");
//await waitForMessage();
//console.log(`Proof received, prod_cfg =\n${JSON.stringify(prod_cfg)}\n`);

function initializeContainer(){
    let container = document.getElementById('graph');
    container.style.width = '100%';
    container.style.height = '100%';

}

function getEdgeId(from_pc, to_pc)
{
  return `${from_pc} -> ${to_pc}`;
}

function get_src_dst_pc_from_prod(pc)
{
  var result = pc.split("_");
  var src_pc = result[0];
  var dst_pc = result[1];
  return {src_pc : src_pc, dst_pc : dst_pc};
}

function set_src_edge_map(edges){
  for (var edge of edges) {
    const e_src_from_pc = get_src_dst_pc_from_prod(edge.from_pc).src_pc;
    const e_src_to_pc = get_src_dst_pc_from_prod(edge.to_pc).src_pc;
    const edgeId = getEdgeId(edge.from_pc, edge.to_pc);
    g_src_edge_map[edgeId] = {from_pc : e_src_from_pc, to_pc : e_src_to_pc};
  }
}

function set_dst_edge_map(edges){
  for (var edge of edges) {
    const e_dst_from_pc = get_src_dst_pc_from_prod(edge.from_pc).dst_pc;
    const e_dst_to_pc = get_src_dst_pc_from_prod(edge.to_pc).dst_pc;
    const edgeId = getEdgeId(edge.from_pc, edge.to_pc);
    g_dst_edge_map[edgeId] = {from_pc : e_dst_from_pc, to_pc : e_dst_to_pc};
  }
}

function getEdgesFromEC_recursive(ec)
{
  if (ec === undefined) {
    return [];
  }
  if (ec.is_epsilon) {
    return [];
  }
  var ret = [];
  switch (ec.name) {
    case 'series':
    case 'parallel':
      const children = ec.serpar_child;
      children.forEach(function (child_ec) {
        const child_ret = getEdgesFromEC_recursive(child_ec);
        ret = arrayUnique(ret.concat(child_ret));
      });
      break;
    case 'edge_with_unroll':
      //console.log(`ec =\n${JSON.stringify(ec)}\n`);
      const eu_edge = { from_pc: ec.from_pc, to_pc: ec.to_pc };
      ret.push(eu_edge);
      break;
  }
  return ret;
}

function getNodesEdgesMap(nodes_in, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map)
{
  var nodeMap = {};
  var nodeIdMap = {};
  var edgeMap = {};
  //var src_nodeMap = {};
  //var dst_nodeMap = {};

  nodes_in.sort(function(a, b) {
    const a_dst_pc = a.split('_')[1];
    const a_dst_pc_index = a_dst_pc.split('%')[0];

    const b_dst_pc = b.split('_')[1];
    const b_dst_pc_index = b_dst_pc.split('%')[0];

    if (b_dst_pc_index.charAt(0) === 'E' && a_dst_pc_index.charAt(0) === 'L') {
      return -1;
    }
    if (b_dst_pc_index.charAt(0) === 'L' && a_dst_pc_index.charAt(0) === 'E') {
      return 1;
    }

    const a_index_name = get_assembly_inum(a_dst_pc_index.substring(1));
    const b_index_name = get_assembly_inum(b_dst_pc_index.substring(1));
    const a_idx = parseInt(a_index_name);
    const b_idx = parseInt(b_index_name);
    return a_idx - b_idx;
  });

  var idx = 0;
  nodes_in.forEach(element => {
    //console.log(`product: node element = ${JSON.stringify(element)}`);
    const src_pc = element.split('_')[0];
    const dst_pc = element.split('_')[1];

    //console.log(`product: src_pc = ${JSON.stringify(src_pc)}`);
    //console.log(`product: dst_pc = ${JSON.stringify(dst_pc)}`);

    const [src_linename, src_columnname, src_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc);
    const [src_ir_linename, src_ir_columnname] = tfg_llvm_obtain_LL_linenum_for_pc(src_tfg_llvm, src_pc);


    var dst_linename, dst_columnname, dst_line_and_column_names;
    var dst_ir_linename, dst_ir_columnname, dst_insn_pc;
    if (dst_tfg_llvm === undefined) {
      [dst_insn_pc, dst_linename, dst_columnname, dst_line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
      dst_linename = parseInt(dst_linename)+1;
      dst_linename=dst_linename.toString();
    } else {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
      [dst_ir_linename, dst_ir_columnname] = tfg_llvm_obtain_LL_linenum_for_pc(dst_tfg_llvm, dst_pc);
      dst_insn_pc = "dst.l" + dst_linename;
    }
    //console.log(`element.pc = ${element}, src_pc = ${src_pc}, dst_pc = ${dst_pc}, src_linename = ${src_linename}, src_columnname = ${src_columnname}, src_line_and_column_names = ${src_line_and_column_names}, dst_linename = ${dst_linename}, dst_columnname = ${dst_columnname}, dst_line_and_column_names = ${dst_line_and_column_names}\n`);

    //const label = src_line_and_column_names + " ; " + dst_line_and_column_names;
    //const label = "dst.l" + dst_linename;
    const label = dst_insn_pc;

    const src_entry = {pc: src_pc, linename: src_linename, ir_linename: src_ir_linename, columnname: src_columnname, ir_columnname: src_ir_columnname!==undefined?src_ir_columnname.toString():undefined, line_and_column_names: src_line_and_column_names};
    const dst_entry = {pc: dst_pc, linename: dst_linename, ir_linename: dst_ir_linename, columnname: dst_columnname, ir_columnname: dst_ir_columnname!==undefined?dst_ir_columnname.toString():undefined, line_and_column_names: dst_line_and_column_names};

    const entry = {idx: idx, pc: element, src_node: src_entry,  dst_node: dst_entry, label: label, level: idx};

    nodeMap[entry.pc] = entry;
    nodeIdMap[entry.idx] = entry;

    //console.log(`Adding to nodeIdMap at index ${entry.idx}, pc ${element}\n`);
    //src_nodeMap[src_entry.pc] = src_entry;
    //dst_nodeMap[dst_entry.pc] = dst_entry;

    idx++;
  });

  cg_edges.forEach(element => {
    const from_pc = element.from_pc;
    const to_pc = element.to_pc;

    const edgeId = getEdgeId(from_pc, to_pc);
    //const entry = { from_pc: from_pc, to_pc: to_pc, dst_edge: dst_entry, src_edge: src_entry };
    const entry = { from_pc: from_pc, to_pc: to_pc, dst_edge: element.dst_edge, src_edge: element.src_edge, allocs: element.allocs, deallocs: element.deallocs };
    edgeMap[edgeId] = entry;
    //console.log(`Adding to edgeMap at index ${JSON.stringify(edgeId)}, entry ${entry}\n`);
  });
  //console.log(`nodeMap =\n${JSON.stringify(nodeMap)}`);
  return [nodeMap, nodeIdMap, edgeMap/*, src_subprogram_info, src_ir_subprogram_info, dst_subprogram_info, dst_ir_subprogram_info, src_nodeMap, src_ir_nodeMap, dst_nodeMap, dst_ir_nodeMap*/];
}

function cg_edge_belongs(cg_ec_edges, edge)
{
  for (var i = 0; i < cg_ec_edges.length; i++) {
    if (cg_ec_edges[i].from_pc == edge.from_pc && cg_ec_edges[i].to_pc == edge.to_pc) {
      return true;
    }
  }
  return false;
}

function mk_array(x) {
  if (x === undefined) return [];
  else if (Array.isArray(x)) return x;
  else return [x];
}

function locals_map_get_name(locals_map, allocsite)
{
  const locals = mk_array(locals_map["graph_local"]);
  //console.log(`locals = ${JSON.stringify(locals)}\n`);
  for (var i = 0; i < locals.length; i++) {
    const local = locals[i];
    if (local.local_allocsite == allocsite) {
      const ret = local.local_name;
      //console.log(`locals_map_get_name returning ${ret} for ${allocsite}\n`);
      return ret;
    }
  }
  //console.log(`locals_map_get_name returning undefined for ${allocsite}\n`);
  return undefined;
}

function get_lsprels(lsprels, locals_map)
{
  //console.log(`lsprels = ${JSON.stringify(lsprels)}`);
  const lsprel_pairs = mk_array(lsprels["local_sprel_expr_pair"]);
  var ret = [];
  //console.log(`lsprel_pairs = ${lsprel_pairs}\n`);
  for (var i = 0; i < lsprel_pairs.length; i++) {
    const lsprel_pair = lsprel_pairs[i];

    const label = lsprel_pair["local_sprel_expr_label_for_gui"];
    //ret[local_name] = sprel_expr;
    ret.push(label);
  }
  //console.log(`ret = ${JSON.stringify(ret)}`);
  return ret;
}

// function drawNetwork_old(correl_entry) {
//     // d3.select("#graph").graphviz()
//     // .renderDot('digraph  {a -> b}');

//     const cg_ec = correl_entry["cg_ec"];

//     const graph_hierarchy = correl_entry["cg"];
//     const graph = graph_hierarchy["graph"];
//     const graph_with_predicates = graph_hierarchy["graph_with_predicates"];

//     const corr_graph = graph_hierarchy["corr_graph"];
//     const cg_collapsed_nodes_and_edges = corr_graph["collapsed_nodes_and_edges_for_gui"];
//     const src_tfg = corr_graph["src_tfg"];
//     const dst_tfg = corr_graph["dst_tfg"];
//     //const cg_edges_ = graph_with_predicates["edge"];
//     const cg_edges_ = cg_collapsed_nodes_and_edges["collapsed_edge"];
//     const cg_edges = mk_array(cg_edges_);
//     const cg_nodes_ = cg_collapsed_nodes_and_edges["node_pc_after_collapse"];
//     const cg_nodes = mk_array(cg_nodes_);

//     const alloc_assumes = corr_graph["alloca_pc_local_sprel_assumes"];
//     const dealloc_assumes = corr_graph["dealloca_pc_local_sprel_assumes"];

//     const src_graph_with_predicates = src_tfg["graph_with_predicates"];
//     const locals_map = src_graph_with_predicates["graph_locals_map"];

//     const src_nodes = src_tfg["graph"]["nodes"];
//     const dst_nodes = dst_tfg["graph"]["nodes"];

//     const src_tfg_llvm = src_tfg["tfg_llvm"];

//     const dst_tfg_llvm = dst_tfg["tfg_llvm"];
//     const dst_tfg_asm = dst_tfg["tfg_asm"];

//     const eqcheck_info = corr_graph["eqcheck_info"];

//     g_eqcheck_info = eqcheck_info;
//     g_src_tfg = src_tfg;
//     g_dst_tfg = dst_tfg;

//     const [dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map] = obtain_insn_arrays_from_eqcheck_info(eqcheck_info, "dst");

//     const cg_ec_edges = getEdgesFromEC_recursive(cg_ec);

//     var nodeMap;
//     [nodeMap, g_nodeIdMap, g_edgeMap/*, g_src_subprogram_info, g_src_ir_subprogram_info, g_dst_subprogram_info, g_dst_ir_subprogram_info, g_src_nodeMap, g_src_ir_nodeMap, g_dst_nodeMap, g_dst_ir_nodeMap*/] = getNodesEdgesMap(cg_nodes, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);

//     var nodes = new vis.DataSet(cg_nodes.map(function(node) {
//       const label_orig = nodeMap[node].label;
//       //console.log(`label_orig = ${label_orig}`);
//       var label = label_orig;
//       const level = nodeMap[node].level;
//       //var x = ((level % 2) * 2 - 1) * 500;
//       //console.log(`node = ${node}, level = ${level}, x = ${x}`);
//       if (node === 'L0%0%d_L0%0%d') {
//         label = "entry";
//       } else if (node.charAt(0) !== 'L') {
//         label = "exit";
//       }
//       return {id:nodeMap[node].idx, label: label, level: level};
//     }));
//     var edges = new vis.DataSet(cg_edges.map(function(edge) {
//       //console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
//       //console.log(`edge from_pc ${edge.from_pc} to_pc ${edge.to_pc}`);
//       const from_idx = nodeMap[edge.from_pc].idx;
//       const to_idx = nodeMap[edge.to_pc].idx;

//       const dst_from_pc = nodeMap[edge.from_pc].dst_node.pc;
//       const dst_to_pc = nodeMap[edge.to_pc].dst_node.pc;

//       const edgeId = getEdgeId(edge.from_pc, edge.to_pc);

//       //console.log(`g_edgeMap[edgeId] = ${JSON.stringify(g_edgeMap[edgeId])}`);

//       const allocs_at_to_pc = g_edgeMap[edgeId].allocs;
//       const deallocs_at_to_pc = g_edgeMap[edgeId].deallocs;

//       const allocs = get_lsprels(allocs_at_to_pc, locals_map);
//       const deallocs = get_lsprels(deallocs_at_to_pc, locals_map);

//       var label = "";

//       //console.log(`allocs = ${JSON.stringify(allocs)}`);
//       for (const l of allocs) {
//         //const sprel = allocs_at_to_pc[local_name];
//         //label = `${label}alloc ${local_name}->${sprel}; `;
//         label = `${label}a ${l}; `;
//       }

//       for (const l of deallocs) {
//         //const sprel = allocs_at_to_pc[local_name];
//         //label = `${label}dealloc ${local_name}->${sprel}; `;
//         label = `${label}d ${l}; `;
//       }

//       var color;

//       if (cg_edge_belongs(cg_ec_edges, edge)) {
//         //console.log(`choosing green`);
//         color = { color: "green" }; //can use "red"
//       } else {
//         //console.log(`choosing blue`);
//         color = { color: "blue" };
//       }

//       //const label = `${from_label} -> ${to_label}`;

//       //console.log(`from_idx = ${from_idx}, to_idx = ${to_idx}\n`);
//       return {from: from_idx, to: to_idx, color: color, label: label};
//     }));
//     // [VIRAJ] This is where the plotting is happenning
//     var network = new vis.Network(document.getElementById('cfg'), {
//         nodes: nodes,
//         edges: edges
//     }, {
//         nodes: {
//             shape: 'ellipse',
//             scaling: {
//                 label: {
//                     enabled: true
//                 }
//             }
//         },
//         edges: {
//             arrows: {
//                 to: {
//                     enabled: true,
//                 },
//             },
//             smooth: {
//                 enabled: true,
//                 type: "continuous",
//                 roundness: 0.5,
//                 //forceDirection: "vertical"
//             },
//             font: {
//                 align: 'horizontal',
//                 color: '#000000',
//                 background: '#ffffff',
//                 size: 16
//             },
//             chosen: {
//                 edge:   function(values, id, selected, hovering) {
//                     if(selected){
//                         values.color = 'rgb(255, 0, 0)';
//                     }
//                   }
//             },
//             width: 6,
//             widthConstraint: {
//                 maximum: 300,
//             }
//         },
//         layout: {
//             hierarchical: {
//                 direction: "UD",
//                 sortMethod: "directed",
//                 //enabled: true,
//                 levelSeparation: 100,
//                 nodeSpacing: 100,
//                 treeSpacing: 400
//                 // shakeTowards: "leaves"
//             }
//         },
//         physics: {
//             enabled: true,
//             // solver: "hierarchicalRepulsion"
//         }
//     });

//     return network; //nodeMap:nodeMap
// }

// This function takes in the nodes and edges of the graph
// And returns the dotsource for generating it

function generateDot(graph_nodes, graph_edges) {
  var dot_src = 'digraph {\n';
  //dot_src += `node [shape="plaintext" style="filled, rounded" fontname="Lato" margin=0.2]\n`;
  dot_src += `node [shape="plaintext" style="filled, rounded" margin=0.2]\n`;

  //console.log(`dot_src = ${dot_src}`);
  // Add declarations for the nodes\"${lab}\"
  for (const node of graph_nodes) {
    //console.log(`id = ${id}`);
    var id = node.id;
    var lab = node.label;
    var color = node.color;
    dot_src += `${id} [id=\"${id}\" label=\"${lab}\" color=\"${color}\"]\n`;
  }
  //console.log(`dot_src = ${dot_src}`);

  // Add declarations for the edges
  // Note: Change penwidth if you want to change thickness of the edges
  for (const edge of graph_edges) {
    //console.log(`edge.from = ${edge.from}, edge.to = ${edge.to}`);
    dot_src += `${edge.from} -> ${edge.to} [id=\"${edge.from}#${edge.to}\" label=\"${edge.label}\" color=\"${edge.color}\" penwidth=3 fontsize="10pt"]\n`;
    // dot_src += `${edge.from} -> ${edge.to} [id=\"${edge.label}\" label=\"${edge.label}\" color=\"\"]\n`;
  }

  dot_src += '}';

  return dot_src;
}


function add_exit_lines(edges,nodeMap,nodeIdMap,src_tfg_llvm,dst_tfg_llvm,dst_tfg_asm,dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map){
  var exit_edge;
  //console.log("Edges= "+JSON.stringify(edges));
  var exit_node_index=(Object.keys(nodeIdMap).length-1).toString();
  for(let i=0;i<edges.length;i++){
    var edge = edges[i];
    if(edge["to_pc"]==="E0%0%d_E0%0%d"){
      exit_edge = edge;
      break;
    }
  }

  var preceding_src_pc,preceding_dst_pc;
  if(exit_edge!==undefined){
    for(var i=0; i<exit_edge["dst_edge"]["graph_ec_constituent_edge_list"]["edge_id"].length;i++){
      const edge=exit_edge["dst_edge"]["graph_ec_constituent_edge_list"]["edge_id"][i];
      if(edge["to_pc"]=== "E0%0%d"){
        preceding_dst_pc = edge["from_pc"];
      }
    }

    for(var i=0; i<exit_edge["src_edge"]["graph_ec_constituent_edge_list"]["edge_id"].length;i++){
      const edge=exit_edge["src_edge"]["graph_ec_constituent_edge_list"]["edge_id"][i];
      if(edge["to_pc"]=== "E0%0%d"){
        preceding_src_pc = edge["from_pc"];
      }
    }
  }

  if(preceding_src_pc !==undefined){
    var src_ir_linename,src_ir_columnname;
    [src_ir_linename, src_ir_columnname] = tfg_llvm_obtain_LL_linenum_for_pc(src_tfg_llvm, preceding_src_pc);

    var src_code_linename,src_code_columnname,src_code_line_and_column_names
    [src_code_linename, src_code_columnname, src_code_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, preceding_src_pc);
    //console.log("src_code_linename= "+src_code_linename+" src_code_columnname= "+src_code_columnname+" src_ir_linename= "+src_ir_linename+" src_ir_columnname= "+src_ir_columnname);
    nodeMap["E0%0%d_E0%0%d"]["src_node"]["linename"]= src_code_linename;
    nodeMap["E0%0%d_E0%0%d"]["src_node"]["columnname"]= src_code_columnname;
    nodeMap["E0%0%d_E0%0%d"]["src_node"]["ir_linename"] = src_ir_linename;
    nodeMap["E0%0%d_E0%0%d"]["src_node"]["ir_columnname"] = src_ir_columnname.toString();
    nodeMap["E0%0%d_E0%0%d"]["src_node"]["line_and_column_names"]="(line "+src_code_linename+" at column 3)";

    nodeIdMap[exit_node_index]["src_node"]["linename"]= src_code_linename;
    nodeIdMap[exit_node_index]["src_node"]["columnname"]= src_code_columnname;
    nodeIdMap[exit_node_index]["src_node"]["ir_linename"] = src_ir_linename;
    nodeIdMap[exit_node_index]["src_node"]["ir_columnname"] = src_ir_columnname.toString();
    nodeIdMap[exit_node_index]["src_node"]["line_and_column_names"]="(line "+src_code_linename+" at column 3)";

  }

  if(preceding_dst_pc !== undefined){

    var dst_ir_linename,dst_ir_columnname,dst_code_linename,dst_code_columnname,dst_insn_pc,dst_code_line_and_column_names;
    if (dst_tfg_llvm === undefined) {

      [dst_insn_pc, dst_code_linename, dst_code_columnname, dst_code_line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, preceding_dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
      dst_code_linename = parseInt(dst_code_linename)+1;
      dst_code_linename=dst_code_linename.toString();
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["linename"] = dst_code_linename;
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["columnname"]= dst_code_columnname;
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["line_and_column_names"]=dst_code_linename+dst_code_columnname;

      nodeIdMap[exit_node_index]["dst_node"]["linename"] = dst_code_linename;
      nodeIdMap[exit_node_index]["dst_node"]["columnname"]= dst_code_columnname;
      nodeIdMap[exit_node_index]["dst_node"]["line_and_column_names"]=dst_code_linename+dst_code_columnname;
    }

    else {

      [dst_ir_linename, dst_ir_columnname] = tfg_llvm_obtain_LL_linenum_for_pc(dst_tfg_llvm, preceding_dst_pc);

      [dst_code_linename, dst_code_columnname, dst_code_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(dst_tfg_llvm, preceding_dst_pc);

      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["linename"]= dst_code_linename;
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["columnname"]= "3";
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["ir_linename"] = dst_ir_linename;
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["ir_columnname"] = dst_ir_columnname.toString();
      nodeMap["E0%0%d_E0%0%d"]["dst_node"]["line_and_column_names"]="(line "+dst_code_linename+" at column 3)";

      nodeIdMap[exit_node_index]["dst_node"]["linename"]= dst_code_linename;
      nodeIdMap[exit_node_index]["dst_node"]["columnname"]= "3";
      nodeIdMap[exit_node_index]["dst_node"]["ir_linename"] = dst_ir_linename;
      nodeIdMap[exit_node_index]["dst_node"]["ir_columnname"] = dst_ir_columnname.toString();
      nodeIdMap[exit_node_index]["dst_node"]["line_and_column_names"]="(line "+dst_code_linename+" at column 3)";


    }


  }

}

function getUnroll(edge){
    var unroll = 1;
    var unroll_is_only_mu = false;
    if(edge.unroll_factor_mu!==edge.unroll_factor_delta.unroll){
      unroll_is_only_mu = true;
      unroll = edge.unroll_factor_mu;
    }
    else{
      unroll = edge.unroll_factor_delta.unroll;
    }
    return [unroll,unroll_is_only_mu];
}

function drawNetwork(correl_entry) {
  // Initial Processing

  const cg_ec = correl_entry["cg_ec"];

  const graph_hierarchy = correl_entry["cg"];
  const graph = graph_hierarchy["graph"];
  const graph_with_predicates = graph_hierarchy["graph_with_predicates"];

  const corr_graph = graph_hierarchy["corr_graph"];
  const cg_collapsed_nodes_and_edges = corr_graph["collapsed_nodes_and_edges_for_gui"];
  const src_tfg = corr_graph["src_tfg"];
  const dst_tfg = corr_graph["dst_tfg"];
  //const cg_edges_ = graph_with_predicates["edge"];
  const cg_edges_ = cg_collapsed_nodes_and_edges["collapsed_edge"];
  const cg_edges = mk_array(cg_edges_);
  const cg_nodes_ = cg_collapsed_nodes_and_edges["node_pc_after_collapse"];
  const cg_nodes = mk_array(cg_nodes_);

  // Send the edges for VIR
  set_src_edge_map(cg_edges);
  set_dst_edge_map(cg_edges);

  // console.log(g_src_edge_map);

  const alloc_assumes = corr_graph["alloca_pc_local_sprel_assumes"];
  const dealloc_assumes = corr_graph["dealloca_pc_local_sprel_assumes"];

  const src_graph_with_predicates = src_tfg["graph_with_predicates"];
  const locals_map = src_graph_with_predicates["graph_locals_map"];

  const src_nodes = src_tfg["graph"]["nodes"];
  const dst_nodes = dst_tfg["graph"]["nodes"];

  const src_tfg_llvm = src_tfg["tfg_llvm"];

  const dst_tfg_llvm = dst_tfg["tfg_llvm"];
  const dst_tfg_asm = dst_tfg["tfg_asm"];

  const eqcheck_info = corr_graph["eqcheck_info"];

  g_eqcheck_info = eqcheck_info;
  g_src_tfg = src_tfg;
  g_dst_tfg = dst_tfg;

  const [dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map] = obtain_insn_arrays_from_eqcheck_info(eqcheck_info, "dst");

  var src_code_subprogram_info, src_ir_subprogram_info;
  if(src_tfg_llvm !== undefined){
    [src_code_subprogram_info, src_ir_subprogram_info] = tfg_llvm_obtain_subprogram_info(src_tfg_llvm);
  }

  var dst_code_subprogram_info, dst_ir_subprogram_info;
  if (dst_tfg_llvm === undefined) {
    dst_code_subprogram_info = tfg_asm_obtain_subprogram_info(dst_tfg_asm, dst_assembly);
    dst_code_subprogram_info["line"] = parseInt(dst_code_subprogram_info["line"]) + 1;
    dst_code_subprogram_info["line"] = dst_code_subprogram_info["line"].toString();
    dst_code_subprogram_info["scope_line"] = parseInt(dst_code_subprogram_info["scope_line"]) + 1;
    dst_code_subprogram_info["scope_line"] = dst_code_subprogram_info["scope_line"].toString();
  } else {
    [dst_code_subprogram_info, dst_ir_subprogram_info] = tfg_llvm_obtain_subprogram_info(dst_tfg_llvm);
  }

  var nodeMap;
  [nodeMap, g_nodeIdMap, g_edgeMap] = getNodesEdgesMap(cg_nodes, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
  nodeMap['L0%0%d_L0%0%d']["src_node"]["linename"] = src_code_subprogram_info.scope_line;
  nodeMap['L0%0%d_L0%0%d']["dst_node"]["linename"] = dst_code_subprogram_info.scope_line;
  nodeMap['L0%0%d_L0%0%d']["src_node"]["columnname"] = "1";
  nodeMap['L0%0%d_L0%0%d']["dst_node"]["columnname"] = "1";
  g_nodeIdMap["0"]["src_node"]["linename"] = src_code_subprogram_info.scope_line;
  g_nodeIdMap["0"]["dst_node"]["linename"] = dst_code_subprogram_info.scope_line;
  g_nodeIdMap["0"]["src_node"]["columnname"] = "1";
  g_nodeIdMap["0"]["dst_node"]["columnname"] = "1";

  nodeMap['L0%0%startCEs_L0%0%startCEs']["src_node"]["linename"] = src_code_subprogram_info.scope_line;
  nodeMap['L0%0%startCEs_L0%0%startCEs']["dst_node"]["linename"] = dst_code_subprogram_info.scope_line;
  nodeMap['L0%0%startCEs_L0%0%startCEs']["src_node"]["columnname"] = "1";
  nodeMap['L0%0%startCEs_L0%0%startCEs']["dst_node"]["columnname"] = "1";
  g_nodeIdMap["1"]["src_node"]["linename"] = src_code_subprogram_info.scope_line;
  g_nodeIdMap["1"]["dst_node"]["linename"] = dst_code_subprogram_info.scope_line;
  g_nodeIdMap["1"]["src_node"]["columnname"] = "1";
  g_nodeIdMap["1"]["dst_node"]["columnname"] = "1";

  //console.log("Edges= "+JSON.stringify(cg_edges));
  add_exit_lines(cg_edges,nodeMap,g_nodeIdMap,src_tfg_llvm,dst_tfg_llvm,dst_tfg_asm,dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);

  const cg_ec_edges = getEdgesFromEC_recursive(cg_ec);

  g_nodePCMap = nodeMap;

  //console.log(`making nodes`);
  // // Array of the nodes of the graph
  var nodes = cg_nodes.map(function(node) {
    var label_orig = nodeMap[node].label;
    //console.log(`label_orig = ${label_orig}`);
    //var label = label_orig;
    //var node_color = "#cfe2f3";
    const level = nodeMap[node].level;

    var color = "#cfe2f3";
    //var x = ((level % 2) * 2 - 1) * 500;
    //console.log(`node = ${node}, level = ${level}`);
    var label = "";
    if (node === 'L0%0%d_L0%0%d') {
      label = "entry: ";
    } else if (node.charAt(0) !== 'L') {
      label = "exit: ";
    }

    if(nodeMap[node].idx==selected_node){
      color = "#ffbaba";
    }
    //<tr>
    //  <td><font point-size="14">${label_orig}</font></td>
    //</tr>


    //var label=`<<table border="0" cellpadding="0" cellspacing="0">
    //<tr>
    //  <td><font point-size="10">`;

    //if(src_codetype==="src"){
    //  label=label+"Src Code Line= "+ nodeMap[node]["src_node"]["linename"];
    //}
    //else{
    //  label=label+"Src IR line= "+ nodeMap[node]["src_node"]["ir_linename"];
    //}
    //label+=`</font></td>
    //</tr>\n`;
    //label+=`<tr>
    //<td><font point-size="10">`;

    //if(dst_codetype==="src"){
    //  label=label+"\n Dst Code Line= "+ nodeMap[node]["dst_node"]["linename"];
    //}
    //else{
    //  label=label+"\n Dst IR Line= "+ nodeMap[node]["dst_node"]["ir_linename"];
    //}
    //label+=`</font></td>
    //</tr>
    //</table>>`

    if(src_codetype==="src"){
      label= label + "s"+ nodeMap[node]["src_node"]["linename"];
    } else{
      label=label+"s"+ nodeMap[node]["src_node"]["ir_linename"];
    }
    label = label + "; ";
    if(dst_codetype==="src"){
      label=label+"d"+ nodeMap[node]["dst_node"]["linename"];
    } else{
      label=label+"d"+ nodeMap[node]["dst_node"]["ir_linename"];
    }

    //console.log(`label =\n${label}`);

    //console.log(nodeMap[node].idx, selected_node)
    //if (nodeMap[node].idx.toString() === selected_node) {
    //  node_color = "#8edeb5";
    //}
    return {id:nodeMap[node].idx, label: label, level: level, color: color};
  });

  //console.log(`making edges`);
  // Array of the edges of the graph
  var edges = cg_edges.map(function(edge) {
    //console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
    //console.log(`edge from_pc ${edge.from_pc} to_pc ${edge.to_pc}`);
    const from_idx = nodeMap[edge.from_pc].idx;
    //console.log(`from_idx = ${JSON.stringify(from_idx)}`);
    const to_idx = nodeMap[edge.to_pc].idx;

    //console.log(`from_idx = ${JSON.stringify(from_idx)}, to_idx = ${JSON.stringify(to_idx)}`);
    const dst_from_pc = nodeMap[edge.from_pc].dst_node.pc;
    const dst_to_pc = nodeMap[edge.to_pc].dst_node.pc;

    const edgeId = getEdgeId(edge.from_pc, edge.to_pc);

    //console.log(`g_edgeMap[edgeId] = ${JSON.stringify(g_edgeMap[edgeId])}`);

    const allocs_at_to_pc = g_edgeMap[edgeId].allocs;
    const deallocs_at_to_pc = g_edgeMap[edgeId].deallocs;

    const allocs = get_lsprels(allocs_at_to_pc, locals_map);
    const deallocs = get_lsprels(deallocs_at_to_pc, locals_map);

    //console.log(`allocs = ${JSON.stringify(allocs)}, deallocs = ${JSON.stringify(deallocs)}`);
    var label="";

    //console.log(`allocs = ${JSON.stringify(allocs)}`);
    for (const l of allocs) {
      //const sprel = allocs_at_to_pc[local_name];
      //label = `${label}alloc ${local_name}->${sprel}; `;nodes
      label = `${label}a ${l}; `;
    }

    for (const l of deallocs) {
      //const sprel = allocs_at_to_pc[local_name];
      //label = `${label}dealloc ${local_name}->${sprel}; `;
      label = `${label}d ${l}; `;
    }

    var [unroll, unroll_is_only_mu] = getUnroll(edge["src_edge"]);
    if(unroll>1){
      if(label!=="") label+=`\n`;
      label+=` src unroll = '`;
      if(unroll_is_only_mu){
        label += "<="
      }
      label+=unroll.toString()+`'`;
    }

    [unroll, unroll_is_only_mu] = getUnroll(edge["dst_edge"]);
    if(unroll>1){
      if(label!=="") label+=`\n`;
      label+=` dst unroll = '`;
      if(unroll_is_only_mu){
        label += `<=`
      }
      label+=unroll.toString()+`'`;
    }

    //console.log(`label = ${JSON.stringify(label)}`);

    var color;
    // console.log("CG EC EDGES" + JSON.stringify(cg_ec_edges));
    if (selected_edge == edgeId) {
        color = "#ff0000";
    } else if (cg_edge_belongs(cg_ec_edges, edge)) {
      //console.log(`choosing green`);
      color = "green"; //can use "red"
    } else {
      //console.log(`choosing blue`);
      color = "#0033cc";
    }

    //const label = `${from_label} -> ${to_label}`;

    //console.log(`from_idx = ${from_idx}, to_idx = ${to_idx}\n`);

    //console.log(`returning from edges map`);
    return {from: from_idx, to: to_idx, color: color, label: label};
  });


  //console.log(`calling generateDot`);

  // Get the dot file from nodes and edges
  var dotSrc = generateDot(nodes, edges);

  //console.log(`returned from generateDot`);
  //console.log(dotSrc);
  // This renders the graph
  const gv = d3.select("#graph").graphviz();
  //console.log(`done gv`);
  const dot = gv.renderDot(dotSrc);
  //console.log(`done dot`);
  dot.zoom(false);
  //console.log(`done zoom`);

  //console.log(`drawNetwork returning`);
  return dotSrc;
}

function refreshPanel()
{
  initializeContainer();

  drawNetwork(g_prodCfg);

  // document.getElementById("graph").onclick = function() {
  //   selected_edge = null;
  //   vscode.postMessage({
  //       command:"clear"
  //   });
  // };

  //console.log(`adding click`);
  d3.select("#graph").on("click", function() {
    //console.log(d3.select("#graph"));
  });

  //console.log(`next inv`);
  document.getElementById("next_inv").addEventListener('click', function(event) {
    if (g_inv_idx < selected_invars.length - 1) {
      g_inv_idx++;
      document.getElementById("inv_txt").innerHTML = selected_invars[g_inv_idx];
    }
  });

  //console.log(`prev inv`);
  document.getElementById("prev_inv").addEventListener('click', function(event) {
    if (g_inv_idx > 0) {
      g_inv_idx--;
      document.getElementById("inv_txt").innerHTML = selected_invars[g_inv_idx];
    }
  });

  //console.log(`click`);
  document.getElementById("graph").addEventListener('click', function(event) {
    console.log(`graph clicked`);
    if (event.target.closest('.edge')) {
      console.log(`graph clicked with edge closest`);
      //console.log("an edge was clicked!");
      document.getElementById("invariants").style.visibility = 'hidden';
      document.getElementById("graph").style.marginTop = '0px';
      selected_node = null;
      return;
    } else {
      if (!event.target.closest('.node')) {
        console.log(`graph clicked with node not closest`);
        selected_node = null;
        document.getElementById("invariants").style.visibility = 'hidden';
        document.getElementById("graph").style.marginTop = '0px';
        selected_edge = null;
        selected_node = null;
        vscode.postMessage({
            command:"clear"
        });
        drawNetwork(g_prodCfg);
      }
    }

  });

  d3.select("#graph")
  .selectAll('.node, .edge')
  .on("mouseover", function () {
    d3.select(this).attr("cursor", "pointer");
  })
  .on("mouseout", function () {
    d3.select(this).attr("cursor", "default");
  });

  d3.select('#graph').selectAll('.node').on('click', function(){
    var node_id = d3.select(this).attr('id');
    console.log(`node clicked`);
    // var labl = d3.select(this).attr('label');
    if (node_id == selected_node){
      selected_edge = null;
      selected_node = null;
      document.getElementById("invariants").style.visibility = 'hidden';
      document.getElementById("graph").style.marginTop = '0px';
    } else {
      selected_edge = null;
      selected_node = node_id;
      //console.log(`selected node ${JSON.stringify(node_id)}`);
      var n_pc = g_nodeIdMap[node_id].pc;
      selected_invars = get_invariants_at_pc(n_pc);
      g_inv_idx = 0;
      if (selected_invars) {
        document.getElementById("inv_txt").innerHTML = selected_invars[g_inv_idx];
      } else {
        document.getElementById("inv_txt").innerHTML = "No invariants to display";
      }
      document.getElementById("invariants").style.visibility = 'visible';
      document.getElementById("graph").style.marginTop = '100px';
      drawNetwork(g_prodCfg);

      //console.log(`inv_txt = ${document.getElementById("inv_txt").innerHTML}`);
      const node = g_nodeIdMap[node_id];
      vscode.postMessage({
        command:"highlight",
        node_edge:"node",
        node: node,
        eqcheck_info: g_eqcheck_info,
        src_tfg: g_src_tfg,
        dst_tfg: g_dst_tfg,
      });
    }
  });

  // Selecting an edge on the TFG
  d3.select("#graph")
  .selectAll('.edge')
  .on("click", function () {
    //console.log(`edge clicked`);
    selected_node = null;
    // debug_str = d3.select(this).attr('id');
    var e_ids = d3.select(this).attr('id').split("#");
    console.log(e_ids);
    const from = g_nodeIdMap[e_ids[0]];
    const to = g_nodeIdMap[e_ids[1]];

    const edgeId = getEdgeId(from.pc, to.pc);

    console.log(`\nedge clicked edgeId = ${edgeId}\n`);
    if (selected_edge == edgeId) {
      // Edge is already selected, deselect
      selected_edge = null;
      selected_node = null;
      vscode.postMessage({
          command:"clear"
      });
      drawNetwork(g_prodCfg);

    } else {
      // Select the new edge
      selected_edge = edgeId;
      selected_node = null;
      const edge = g_edgeMap[edgeId];
      const src_edge_vir = g_src_edge_map[edgeId];
      const dst_edge_vir = g_dst_edge_map[edgeId];
      vscode.postMessage({
        command:"highlight",
        node_edge:"edge",
        from: from,
        to: to,
        edge: edge,
        eqcheck_info: g_eqcheck_info,
        src_tfg: g_src_tfg,
        dst_tfg: g_dst_tfg,
        src_edge_vir : src_edge_vir,
        dst_edge_vir : dst_edge_vir
      });
      drawNetwork(g_prodCfg);
    }

  });

  //d3.select("#graph")
  //.selectAll('.node')
  //.on("click",function(){
  //  var nodeId=d3.select(this).attr('id');
  //
  //  if (selected_node == nodeId) {
  //    // Edge is already selected, deselect
  //    selected_edge = null;
  //    selected_node = null;
  //    vscode.postMessage({
  //        command:"clear"
  //    });
  //    drawNetwork(g_prodCfg);
  //  } else {
  //    // Select the new edge
  //    selected_edge = null;
  //    selected_node = nodeId;
  //    const node = g_nodeIdMap[nodeId];
  //    vscode.postMessage({
  //      command:"highlight",
  //      node_edge:"node",
  //      node: node,
  //      eqcheck_info: g_eqcheck_info,
  //      src_tfg: g_src_tfg,
  //      dst_tfg: g_dst_tfg
  //    });
  //    drawNetwork(g_prodCfg);
  //  }
  //
  //}
  //);


}
