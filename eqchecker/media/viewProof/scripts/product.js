/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG
*/

import {arrayUnique, convert_long_long_map_json_to_associative_array} from "./utils.js";
import {dst_asm_compute_index_to_line_map,tfg_llvm_obtain_subprogram_info,tfg_asm_obtain_subprogram_info,obtain_insn_arrays_from_eqcheck_info,tfg_asm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_line_and_column_names_for_pc} from "./tfg.js";
// import { graphviz } from 'd3-graphviz';
// import * as d3 from 'd3';

const vscode = acquireVsCodeApi();

var g_prodCfg = null;
var g_bveq_invars = null;
var g_bvineq_invars = null;
var g_mem_invars = null;
var g_inv_idx = 0;

//var g_nodeMap = null;
var g_nodeIdMap = null;
var g_edgeMap = null;
var g_src_tfg = null;
var g_dst_tfg = null;
var selected_edge = null;
var selected_node = null;
var g_eqcheck_info = null;
var g_src_edge_map = {};
var g_dst_edge_map = {};

var selected_invars = null;

window.addEventListener('message', async event => {
    const message = event.data;
    //console.log(`RECEIVED EVENT: ${JSON.stringify(message)}\n`);
    switch (message.command) {
      case 'showProof':
        g_prodCfg = message.code;
        g_bveq_invars = message.bveq_invars;
        g_bvineq_invars = message.bvineq_invars;
        g_mem_invars = message.mem_invars;
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
    }
});

//async function waitForMessage(){
//    while(g_prodCfg === null){
//        //console.log("prod_cfg is still NULL");
//        await new Promise(r => window.setTimeout(r, 1000));
//    }
//}
vscode.postMessage({command:"loaded"});

function get_invariants_at_pc(pc){
  console.log("Searching for PC", pc);
  var invars = []
  for (var i = 0; i < g_bveq_invars.map.entry.length; i++){
    console.log("Currently at", g_bveq_invars.map.entry[i].key);
    if (g_bveq_invars.map.entry[i].key == pc) {
      for (var j = 0; j < g_bveq_invars.map.entry[i].value.length; j++){
        invars.push(g_bveq_invars.map.entry[i].value[j]);
      }
      break;
    }
  }
  return invars;
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

    const a_index_name = a_dst_pc_index.substring(1);
    const b_index_name = b_dst_pc_index.substring(1);
    const a_idx = parseInt(a_index_name);
    const b_idx = parseInt(b_index_name);
    return a_idx - b_idx;
  });

  var idx = 0;
  nodes_in.forEach(element => {
    const src_pc = element.split('_')[0];
    const dst_pc = element.split('_')[1];

    const [src_linename, src_columnname, src_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc);
    //const [src_ir_linename, src_ir_columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(src_tfg_llvm, src_pc);

    var dst_linename, dst_columnname, dst_line_and_column_names;
    var dst_ir_linename, dst_ir_columnname, dst_insn_pc;
    if (dst_tfg_llvm === undefined) {
      [dst_insn_pc, dst_linename, dst_columnname, dst_line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
    } else {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
      //[dst_ir_linename, dst_ir_columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
      dst_insn_pc = "dst.l" + dst_linename;
    }
    //console.log(`element.pc = ${element}, src_pc = ${src_pc}, dst_pc = ${dst_pc}, src_linename = ${src_linename}, src_columnname = ${src_columnname}, src_line_and_column_names = ${src_line_and_column_names}, dst_linename = ${dst_linename}, dst_columnname = ${dst_columnname}, dst_line_and_column_names = ${dst_line_and_column_names}\n`);

    //const label = src_line_and_column_names + " ; " + dst_line_and_column_names;
    //const label = "dst.l" + dst_linename;
    const label = dst_insn_pc;

    const src_entry = {pc: src_pc, linename: src_linename/*, ir_linename: src_ir_linename*/, columnname: src_columnname/*, ir_columnname: src_ir_columnname*/, line_and_column_names: src_line_and_column_names};
    const dst_entry = {pc: dst_pc, linename: dst_linename/*, ir_linename: dst_ir_linename*/, columnname: dst_columnname/*, ir_columnname: dst_ir_columnname*/, line_and_column_names: dst_line_and_column_names};

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

function drawNetwork_old(correl_entry) {
    // d3.select("#graph").graphviz()
    // .renderDot('digraph  {a -> b}');

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

    const cg_ec_edges = getEdgesFromEC_recursive(cg_ec);

    var nodeMap;
    [nodeMap, g_nodeIdMap, g_edgeMap/*, g_src_subprogram_info, g_src_ir_subprogram_info, g_dst_subprogram_info, g_dst_ir_subprogram_info, g_src_nodeMap, g_src_ir_nodeMap, g_dst_nodeMap, g_dst_ir_nodeMap*/] = getNodesEdgesMap(cg_nodes, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);

    var nodes = new vis.DataSet(cg_nodes.map(function(node) {
      const label_orig = nodeMap[node].label;
      //console.log(`label_orig = ${label_orig}`);
      var label = label_orig;
      const level = nodeMap[node].level;
      //var x = ((level % 2) * 2 - 1) * 500;
      //console.log(`node = ${node}, level = ${level}, x = ${x}`);
      if (node === 'L0%0%d_L0%0%d') {
        label = "entry";
      } else if (node.charAt(0) !== 'L') {
        label = "exit";
      }
      return {id:nodeMap[node].idx, label: label, level: level};
    }));
    var edges = new vis.DataSet(cg_edges.map(function(edge) {
      //console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
      //console.log(`edge from_pc ${edge.from_pc} to_pc ${edge.to_pc}`);
      const from_idx = nodeMap[edge.from_pc].idx;
      const to_idx = nodeMap[edge.to_pc].idx;

      const dst_from_pc = nodeMap[edge.from_pc].dst_node.pc;
      const dst_to_pc = nodeMap[edge.to_pc].dst_node.pc;

      const edgeId = getEdgeId(edge.from_pc, edge.to_pc);

      //console.log(`g_edgeMap[edgeId] = ${JSON.stringify(g_edgeMap[edgeId])}`);

      const allocs_at_to_pc = g_edgeMap[edgeId].allocs;
      const deallocs_at_to_pc = g_edgeMap[edgeId].deallocs;

      const allocs = get_lsprels(allocs_at_to_pc, locals_map);
      const deallocs = get_lsprels(deallocs_at_to_pc, locals_map);

      var label = "";

      //console.log(`allocs = ${JSON.stringify(allocs)}`);
      for (const l of allocs) {
        //const sprel = allocs_at_to_pc[local_name];
        //label = `${label}alloc ${local_name}->${sprel}; `;
        label = `${label}a ${l}; `;
      }

      for (const l of deallocs) {
        //const sprel = allocs_at_to_pc[local_name];
        //label = `${label}dealloc ${local_name}->${sprel}; `;
        label = `${label}d ${l}; `;
      }

      var color;

      if (cg_edge_belongs(cg_ec_edges, edge)) {
        //console.log(`choosing green`);
        color = { color: "green" }; //can use "red"
      } else {
        //console.log(`choosing blue`);
        color = { color: "blue" };
      }

      //const label = `${from_label} -> ${to_label}`;

      //console.log(`from_idx = ${from_idx}, to_idx = ${to_idx}\n`);
      return {from: from_idx, to: to_idx, color: color, label: label};
    }));
    // [VIRAJ] This is where the plotting is happenning 
    var network = new vis.Network(document.getElementById('cfg'), {
        nodes: nodes,
        edges: edges
    }, {
        nodes: {
            shape: 'ellipse',
            scaling: {
                label: {
                    enabled: true
                }
            }
        },
        edges: {
            arrows: {
                to: {
                    enabled: true,
                },
            },
            smooth: {
                enabled: true,
                type: "continuous",
                roundness: 0.5,
                //forceDirection: "vertical"
            },
            font: {
                align: 'horizontal',
                color: '#000000',
                background: '#ffffff',
                size: 16
            },
            chosen: {
                edge:   function(values, id, selected, hovering) {
                    if(selected){
                        values.color = 'rgb(255, 0, 0)';
                    }
                  }
            },
            width: 6,
            widthConstraint: {
                maximum: 300,
            }
        },
        layout: {
            hierarchical: {
                direction: "UD",
                sortMethod: "directed",
                //enabled: true,
                levelSeparation: 100,
                nodeSpacing: 100,
                treeSpacing: 400
                // shakeTowards: "leaves"
            }
        },
        physics: {
            enabled: true,
            // solver: "hierarchicalRepulsion"
        }
    });

    return network; //nodeMap:nodeMap
}

// This function takes in the nodes and edges of the graph
// And returns the dotsource for generating it

function generateDot(graph_nodes, graph_edges) {
  var dot_src = 'digraph {\n';
  dot_src += `node [shape="plaintext" style="filled, rounded" fontname="Lato" margin=0.2  ]\n`;

  // Add declarations for the nodes\"${lab}\"
  for (const node of graph_nodes) {
    var id = node.id;
    var lab = node.label;
    var color = node.color;
    dot_src += `${id} [id=\"${id}\" label=\"${lab}\" color=\"${color}\"]\n`;
  }

  // Add declarations for the edges
  // Note: Change penwidth if you want to change thickness of the edges  
  for (const edge of graph_edges) {
    dot_src += `${edge.from} -> ${edge.to} [id=\"${edge.from}#${edge.to}\" label=\"${edge.label}\" color=\"${edge.color}\" penwidth=3]\n`;
    // dot_src += `${edge.from} -> ${edge.to} [id=\"${edge.label}\" label=\"${edge.label}\" color=\"\"]\n`;
  }

  dot_src += '}';

  return dot_src;
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

  var nodeMap;
  [nodeMap, g_nodeIdMap, g_edgeMap/*, g_src_subprogram_info, g_src_ir_subprogram_info, g_dst_subprogram_info, g_dst_ir_subprogram_info, g_src_nodeMap, g_src_ir_nodeMap, g_dst_nodeMap, g_dst_ir_nodeMap*/] = getNodesEdgesMap(cg_nodes, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);

  const cg_ec_edges = getEdgesFromEC_recursive(cg_ec);

  // // Array of the nodes of the graph
  var nodes = cg_nodes.map(function(node) {
    const label_orig = nodeMap[node].label;
    //console.log(`label_orig = ${label_orig}`);
    var label = label_orig;
    var node_color = "#cfe2f3";
    const level = nodeMap[node].level;
    //var x = ((level % 2) * 2 - 1) * 500;
    //console.log(`node = ${node}, level = ${level}, x = ${x}`);
    if (node === 'L0%0%d_L0%0%d') {
      label = "entry";
    } else if (node.charAt(0) !== 'L') {
      label = "exit";
    }
    console.log(nodeMap[node].idx, selected_node)
    if (nodeMap[node].idx.toString() === selected_node) {
      node_color = "#8edeb5";
    }
    return {id:nodeMap[node].idx, label: label, level: level, color:node_color};
  });

  // Array of the edges of the graph
  var edges = cg_edges.map(function(edge) {
    //console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
    //console.log(`edge from_pc ${edge.from_pc} to_pc ${edge.to_pc}`);
    const from_idx = nodeMap[edge.from_pc].idx;
    const to_idx = nodeMap[edge.to_pc].idx;

    const dst_from_pc = nodeMap[edge.from_pc].dst_node.pc;
    const dst_to_pc = nodeMap[edge.to_pc].dst_node.pc;

    const edgeId = getEdgeId(edge.from_pc, edge.to_pc);

    //console.log(`g_edgeMap[edgeId] = ${JSON.stringify(g_edgeMap[edgeId])}`);

    const allocs_at_to_pc = g_edgeMap[edgeId].allocs;
    const deallocs_at_to_pc = g_edgeMap[edgeId].deallocs;

    const allocs = get_lsprels(allocs_at_to_pc, locals_map);
    const deallocs = get_lsprels(deallocs_at_to_pc, locals_map);

    var label = "";

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
    
    return {from: from_idx, to: to_idx, color: color, label: label};
  });



  // Get the dot file from nodes and edges
  var dotSrc = generateDot(nodes, edges);

  // This renders the graph
  d3.select("#graph").graphviz()
    .renderDot(dotSrc)
    .zoom(false);

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
  
  d3.select("#graph").on("click", function() {
    console.log(d3.select("#graph"));
  });

  document.getElementById("next_inv").addEventListener('click', function(event) {
    if (g_inv_idx < selected_invars.length - 1) {
      g_inv_idx++;
      document.getElementById("inv_txt").innerHTML = selected_invars[g_inv_idx];
    }
  });

  document.getElementById("prev_inv").addEventListener('click', function(event) {
    if (g_inv_idx > 0) {
      g_inv_idx--;
      document.getElementById("inv_txt").innerHTML = selected_invars[g_inv_idx];
    }
  });

  document.getElementById("graph").addEventListener('click', function(event) {
    if (event.target.closest('.edge')) {
      // console.log("an edge was clicked!");
      document.getElementById("invariants").style.visibility = 'hidden';
      document.getElementById("graph").style.marginTop = '0px';
      selected_node = null;
      return;
    } else {
      if (!event.target.closest('.node')) {
        selected_node = null;
        document.getElementById("invariants").style.visibility = 'hidden';
        document.getElementById("graph").style.marginTop = '0px';
      } 
      selected_edge = null;
      vscode.postMessage({
          command:"clear"
      });
      drawNetwork(g_prodCfg);
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
    // var labl = d3.select(this).attr('label');
    if (node_id == selected_node){
      selected_node = null;
      document.getElementById("invariants").style.visibility = 'hidden';
      document.getElementById("graph").style.marginTop = '0px';
    } else {
      selected_node = node_id;
      var n_pc = g_nodeIdMap[node_id].pc;
      selected_invars = get_invariants_at_pc(n_pc);
      g_inv_idx = 0;
      if (selected_invars.length > 0) {
        document.getElementById("inv_txt").innerHTML = selected_invars[g_inv_idx];
      } else {
        document.getElementById("inv_txt").innerHTML = "No invariants to display";
      }
      document.getElementById("invariants").style.visibility = 'visible';
      document.getElementById("graph").style.marginTop = '100px';
    }
    drawNetwork(g_prodCfg);
  })

  // Selecting an edge on the TFG
  d3.select("#graph")
  .selectAll('.edge')
  .on("click", function () {
    selected_node = null;
    // debug_str = d3.select(this).attr('id');
    var e_ids = d3.select(this).attr('id').split("#");
    const from = g_nodeIdMap[e_ids[0]];
    const to = g_nodeIdMap[e_ids[1]];

    const edgeId = getEdgeId(from.pc, to.pc);

    if (selected_edge == edgeId) {
      // Edge is already selected, deselect
      selected_edge = null;
      vscode.postMessage({
          command:"clear"
      });
      drawNetwork(g_prodCfg);
      
    } else {
      // Select the new edge
      selected_edge = edgeId;
      const edge = g_edgeMap[edgeId];
      const src_edge_vir = g_src_edge_map[edgeId];
      const dst_edge_vir = g_dst_edge_map[edgeId];
      vscode.postMessage({
        command:"highlight",
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

  })

}
