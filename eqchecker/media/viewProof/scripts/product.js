/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG
*/

import {arrayUnique, convert_long_long_map_json_to_associative_array} from "./utils.js";
import {dst_asm_compute_index_to_line_map,tfg_llvm_obtain_subprogram_info,tfg_asm_obtain_subprogram_info,obtain_insn_arrays_from_eqcheck_info,tfg_asm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_line_and_column_names_for_pc,tfg_llvm_obtain_ir_line_and_column_names_for_pc} from "./tfg.js";

const vscode = acquireVsCodeApi();

var g_prodCfg = null;
//var g_nodeMap = null;
var g_nodeIdMap = null;
var g_edgeMap = null;
var g_src_tfg = null;
var g_dst_tfg = null;
var g_eqcheck_info = null;
//var g_src_subprogram_info = null;
//var g_src_ir_subprogram_info = null;
//var g_dst_subprogram_info = null;
//var g_dst_ir_subprogram_info = null;
//var g_src_nodeMap = null;
//var g_src_ir_nodeMap = null;
//var g_dst_nodeMap = null;
//var g_dst_ir_nodeMap = null;

window.addEventListener('message', async event => {
    const message = event.data;
    //console.log(`RECEIVED EVENT: ${JSON.stringify(message)}\n`);
    switch (message.command) {
      case 'showProof':
        g_prodCfg = message.code;
        //console.log("RECEIVED showProof. refreshing panel\n");
        refreshPanel();
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

//console.log("Waiting for proof\n");
//await waitForMessage();
//console.log(`Proof received, prod_cfg =\n${JSON.stringify(prod_cfg)}\n`);

function initializeContainer(){
    let container = document.getElementById('cfg');
    container.style.width = '100%';
    container.style.height = '100%';
}

function getEdgeId(from_pc, to_pc)
{
  return `${from_pc} -> ${to_pc}`;
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

  var idx = 0;
  nodes_in.forEach(element => {
    const src_pc = element.pc.split('_')[0];
    const dst_pc = element.pc.split('_')[1];

    const [src_linename, src_columnname, src_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc);
    const [src_ir_linename, src_ir_columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(src_tfg_llvm, src_pc);

    var dst_linename, dst_columnname, dst_line_and_column_names;
    var dst_ir_linename, dst_ir_columnname, dst_insn_pc;
    if (dst_tfg_llvm === undefined) {
      [dst_insn_pc, dst_linename, dst_columnname, dst_line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
    } else {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
      [dst_ir_linename, dst_ir_columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
      dst_insn_pc = "dst.l" + dst_linename;
    }
    //console.log(`element.pc = ${element.pc}, src_pc = ${src_pc}, dst_pc = ${dst_pc}, src_linename = ${src_linename}, src_columnname = ${src_columnname}, src_line_and_column_names = ${src_line_and_column_names}, dst_linename = ${dst_linename}, dst_columnname = ${dst_columnname}, dst_line_and_column_names = ${dst_line_and_column_names}\n`);

    //const label = src_line_and_column_names + " ; " + dst_line_and_column_names;
    //const label = "dst.l" + dst_linename;
    const label = dst_insn_pc;

    const src_entry = {pc: src_pc, linename: src_linename, ir_linename: src_ir_linename, columnname: src_columnname, ir_columnname: src_ir_columnname, line_and_column_names: src_line_and_column_names};
    const dst_entry = {pc: dst_pc, linename: dst_linename, ir_linename: dst_ir_linename, columnname: dst_columnname, ir_columnname: dst_ir_columnname, line_and_column_names: dst_line_and_column_names};

    const entry = {idx: idx, pc: element.pc, src_node: src_entry, dst_node: dst_entry, label: label, level: idx};

    nodeMap[entry.pc] = entry;
    nodeIdMap[entry.idx] = entry;

    //console.log(`Adding to nodeIdMap at index ${entry.idx}, pc ${element.pc}\n`);
    //src_nodeMap[src_entry.pc] = src_entry;
    //dst_nodeMap[dst_entry.pc] = dst_entry;

    idx++;
  });

  cg_edges.forEach(element => {
    const from_pc = element.edge.from_pc;
    const to_pc = element.edge.to_pc;

    //const dst_from_pc = element.dst_edge.from_pc;
    //const dst_to_pc = element.dst_edge.to_pc;
    //const dst_unroll_factor_mu = element.dst_edge.unroll_factor_mu;
    //const dst_unroll_factor_delta = element.dst_edge.unroll_factor_delta.unroll;
    //const dst_ec = element.dst_edge.graph_ec;

    //const src_from_pc = element.src_edge.from_pc;
    //const src_to_pc = element.src_edge.to_pc;
    //const src_unroll_factor_mu = element.src_edge.unroll_factor_mu;
    //const src_unroll_factor_delta = element.src_edge.unroll_factor_delta.unroll;
    //const src_ec = element.src_edge.graph_ec;

    //const src_entry = { from_pc: src_from_pc, to_pc: src_to_pc, unroll_factor_mu: src_unroll_factor_mu, unroll_factor_delta: src_unroll_factor_delta, ec: src_ec };
    //const dst_entry = { from_pc: dst_from_pc, to_pc: dst_to_pc, unroll_factor_mu: dst_unroll_factor_mu, unroll_factor_delta: dst_unroll_factor_delta, ec: dst_ec };

    const edgeId = getEdgeId(from_pc, to_pc);
    //const entry = { from_pc: from_pc, to_pc: to_pc, dst_edge: dst_entry, src_edge: src_entry };
    const entry = { from_pc: from_pc, to_pc: to_pc, dst_edge: element.dst_edge, src_edge: element.src_edge };
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
  const lsprel_pairs = mk_array(lsprels["local_sprel_expr_pair"]);
  var ret = {};
  //console.log(`lsprel_pairs = ${lsprel_pairs}\n`);
  for (var i = 0; i < lsprel_pairs.length; i++) {
    const lsprel_pair = lsprel_pairs[i];
    const allocsite = lsprel_pair["local_id"];
    const sprel_expr = lsprel_pair["sprel_expr"];
    const local_name = locals_map_get_name(locals_map, allocsite);
    //console.log(`adding ${local_name} -> ${sprel_expr}\n`);
    ret[local_name] = sprel_expr;
  }
  return ret;
}

function get_alloc_dealloc_map(ad_assumes, locals_map)
{
  var ret = {};
  const pc_lsprels = mk_array(ad_assumes["pc_lsprel"]);
  //console.log(`pc_lsprels = ${JSON.stringify(pc_lsprels)}\n`);
  for (var i = 0; i < pc_lsprels.length; i++) {
    const dst_pc = pc_lsprels[i].pc;
    const lsprels = get_lsprels(pc_lsprels[i].local_sprel_expr_guesses, locals_map);
    ret[dst_pc] = lsprels;
  }
  return ret;
}

function get_alloc_dealloc_map_for_edge(ad_map, dst_from_pc, dst_to_pc, allocdealloc)
{
  const dst_from_pc_components = dst_from_pc.split('%');
  const dst_to_pc_components = dst_to_pc.split('%');
  if (dst_from_pc_components[0] != dst_to_pc_components[0]) {
    return {};
  }
  if (dst_from_pc_components[1] != dst_to_pc_components[1]) {
    return {};
  }
  if (!dst_from_pc_components[2].startsWith(allocdealloc) && !dst_to_pc_components[2].startsWith(allocdealloc)) {
    return {};
  }
  for (var pc in ad_map) {
    const pc_components = pc.split('%');
    const pc_to_compare = (allocdealloc == "alloc") ? dst_to_pc_components : dst_from_pc_components;
    if (pc_components[0] == pc_to_compare[0] && pc_components[1] == pc_to_compare[1]) {
      return ad_map[pc];
    }
  }
  return {};
}

function drawNetwork(correl_entry) {

    //var nodeMap = {};
    //var idx = 0;
    //console.log(`drawNetwork: prod_cfg =\n${JSON.stringify(cfg)}\n`);
    //const graph_hierarchy = cfg["graph-hierarchy"];

    const cg_ec = correl_entry["cg_ec"];

    const graph_hierarchy = correl_entry["cg"];
    const graph = graph_hierarchy["graph"];
    const graph_with_predicates = graph_hierarchy["graph_with_predicates"];
    const nodes_in_ = graph["nodes"];
    const edges_in_ = graph["edges"];
    const cg_edges_ = graph_with_predicates["edge"];
    const nodes_in = mk_array(nodes_in_);
    const edges_in = mk_array(edges_in_);
    const cg_edges = mk_array(cg_edges_);
    const corr_graph = graph_hierarchy["corr_graph"];
    const src_tfg = corr_graph["src_tfg"];
    const dst_tfg = corr_graph["dst_tfg"];

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
    //console.log(`cg_ec_edges length = ${cg_ec_edges.length}`);

    //console.log(`dst_insn_pcs =\n`);
    //for (var key in dst_insn_pcs) {
    //  const val = dst_insn_pcs[key];
    //  console.log(`${key} -> ${val}`);
    //}
    //console.log(`dst_pc_to_assembly_index_map =\n`);
    //for (var key in dst_pc_to_assembly_index_map) {
    //  const val = dst_pc_to_assembly_index_map[key];
    //  console.log(`${key} -> ${val}`);
    //}
    //console.log(`dst_assembly_index_to_assembly_line_map =\n`);
    //for (var key in dst_assembly_index_to_assembly_line_map) {
    //  const val = dst_assembly_index_to_assembly_line_map[key];
    //  console.log(`${key} -> ${val}`);
    //}

    //const dst_insn_index_to_assembly_line_map = (dst_assembly==="") ? undefined : dst_asm_compute_index_to_line_map(dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map);

    //console.log(`dst_insn_index_to_assembly_line_map =\n`);
    //for (var key in dst_insn_index_to_assembly_line_map) {
    //  const val = dst_insn_index_to_assembly_line_map[key];
    //  console.log(`${key} -> ${val}`);
    //}

    var nodeMap;
    [nodeMap, g_nodeIdMap, g_edgeMap/*, g_src_subprogram_info, g_src_ir_subprogram_info, g_dst_subprogram_info, g_dst_ir_subprogram_info, g_src_nodeMap, g_src_ir_nodeMap, g_dst_nodeMap, g_dst_ir_nodeMap*/] = getNodesEdgesMap(nodes_in, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);

    const alloc_map = get_alloc_dealloc_map(alloc_assumes, locals_map);
    const dealloc_map = get_alloc_dealloc_map(dealloc_assumes, locals_map);

    //console.log(`nodeMap = ${JSON.stringify(nodeMap)}`);
    var nodes = new vis.DataSet(nodes_in.map(function(node) {
      const label_orig = nodeMap[node.pc].label;
      //console.log(`label_orig = ${label_orig}`);
      var label = label_orig;
      const level = nodeMap[node.pc].level;
      //var x = ((level % 2) * 2 - 1) * 500;
      //console.log(`node = ${node.pc}, level = ${level}, x = ${x}`);
      if (node.pc === 'L0%0%d_L0%0%d') {
        label = "entry";
      } else if (node.pc.charAt(0) !== 'L') {
        label = "exit";
      }
      return {id:nodeMap[node.pc].idx, label: label, level: level};
    }));
    var edges = new vis.DataSet(edges_in.map(function(edge) {
      const from_idx = nodeMap[edge.from_pc].idx;
      const to_idx = nodeMap[edge.to_pc].idx;

      //const src_linename_from = nodeMap[edge.from_pc].src_node.linename;
      //const dst_linename_from = nodeMap[edge.from_pc].dst_node.linename;
      //const src_columnname_from = nodeMap[edge.from_pc].src_node.columnname;
      //const dst_columnname_from = nodeMap[edge.from_pc].dst_node.columnname;

      //const src_linename_to = nodeMap[edge.to_pc].src_node.linename;
      //const dst_linename_to = nodeMap[edge.to_pc].dst_node.linename;
      //const src_columnname_to = nodeMap[edge.to_pc].src_node.columnname;
      //const dst_columnname_to = nodeMap[edge.to_pc].dst_node.columnname;

      //var from_label = `(${src_linename_from}c${src_columnname_from}, ${dst_linename_from}c${dst_columnname_from})`;
      //var to_label = `(${src_linename_to}c${src_columnname_to},${dst_linename_to}c${dst_columnname_to})`;

      //if (edge.from_pc === 'L0%0%d_L0%0%d') {
      //  from_label = "entry";
      //}
      //if (edge.to_pc.charAt(0) !== 'L') {
      //  to_label = "exit";
      //}

      const dst_from_pc = nodeMap[edge.from_pc].dst_node.pc;
      const dst_to_pc = nodeMap[edge.to_pc].dst_node.pc;

      const allocs_at_to_pc = get_alloc_dealloc_map_for_edge(alloc_map, dst_from_pc, dst_to_pc, "alloc");
      const deallocs_at_to_pc = get_alloc_dealloc_map_for_edge(dealloc_map, dst_from_pc, dst_to_pc, "dealloc");

      //console.log(`alloc_map = ${JSON.stringify(alloc_map)}`);
      //console.log(`dst_to_pc = ${dst_to_pc}, allocs_at_to_pc = ${allocs_at_to_pc}`);

      var label = "";

      if (allocs_at_to_pc !== undefined) {
        for (const local_name in allocs_at_to_pc) {
          const sprel = allocs_at_to_pc[local_name];
          label = `${label}alloc ${local_name}->${sprel}; `;
        }
      }

      if (deallocs_at_to_pc !== undefined) {
        for (const local_name in deallocs_at_to_pc) {
          const sprel = allocs_at_to_pc[local_name];
          label = `${label}dealloc ${local_name}->${sprel}; `;
        }
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

function refreshPanel()
{
  initializeContainer();
  var network = drawNetwork(g_prodCfg);
  //var res = drawNetwork(g_prodCfg);

  network.on("stabilizationIterationsDone", function(){
    network.setOptions( { physics: false } );
  });

  //var network = res.network;
  //var nodeMap = res.nodeMap;

  network.on('selectEdge', function(properties) {
      let propEdgeId = properties.edges[0];
      let propEdge = network.body.data.edges.get(propEdgeId);
      //console.log(`propEdge.from = ${propEdge.from}`);
      //console.log(`propEdge.to = ${propEdge.to}`);
      const from = g_nodeIdMap[propEdge.from];
      const to = g_nodeIdMap[propEdge.to];
      const edgeId = getEdgeId(from.pc, to.pc);
      const edge = g_edgeMap[edgeId];

      //console.log(`from = ${JSON.stringify(from)}`);
      //console.log(`to = ${JSON.stringify(to)}`);
      //console.log(`edgeId = ${JSON.stringify(edgeId)}`);
      //console.log(`highlighting edge = ${JSON.stringify(edge)}`);

      vscode.postMessage({
          command:"highlight",
          from: from,
          to: to,
          edge: edge,
          eqcheck_info: g_eqcheck_info,
          src_tfg: g_src_tfg,
          dst_tfg: g_dst_tfg
          //src_subprogram_info: g_src_subprogram_info,
          //src_ir_subprogram_info: g_src_ir_subprogram_info,
          //dst_subprogram_info: g_dst_subprogram_info,
          //dst_ir_subprogram_info: g_dst_ir_subprogram_info,
          //src_nodeMap: g_src_nodeMap,
          //src_ir_nodeMap: g_src_ir_nodeMap,
          //dst_nodeMap: g_dst_nodeMap,
          //dst_ir_nodeMap: g_dst_ir_nodeMap
      });
  });

  network.on('deselectEdge', function(properties) {
      vscode.postMessage({
          command:"clear"
      });
  });
}
