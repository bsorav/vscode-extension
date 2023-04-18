/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG
*/

const vscode = acquireVsCodeApi();

var g_prodCfg = null;
var g_nodeMap = null;
var g_nodeIdMap = null;
var g_edgeMap = null;
var g_src_subprogram_info = null;
var g_src_ir_subprogram_info = null;
var g_dst_subprogram_info = null;
var g_dst_ir_subprogram_info = null;
var g_src_nodeMap = null;
var g_src_ir_nodeMap = null;
var g_dst_nodeMap = null;
var g_dst_ir_nodeMap = null;

const default_columnname_for_assembly = 4;
const default_columnname_for_ir = 4;

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

function line_column_map_get_value_for_pc(proptree, p, key)
{
  //console.log("proptree =\n" + JSON.stringify(proptree));
  const arr = proptree[key];
  //console.log("key = " + key + ", arr =\n" + JSON.stringify(arr));
  for (var i = 0; i < arr.length; i++) {
    //console.log("d2=\n" + JSON.stringify(d2));
    if (arr[i].pc === p) {
      return arr[i].string;
    }
  }
  return undefined;
}

function tfg_llvm_obtain_subprogram_info(tfg_llvm)
{
  return [tfg_llvm.llvm_subprogram_debug_info, tfg_llvm.llvm_ir_subprogram_debug_info];
}

function tfg_llvm_obtain_ir_line_and_column_names_for_pc(tfg_llvm, pc)
{
  var ir_linename;
  const ir_linename_map = tfg_llvm["ir_linename_map"];
  if (ir_linename_map === undefined) {
    return [0,0];
  }

  const index = pc.split('%')[0];
  if (index.charAt(0) === 'L' && pc !== 'L0%0%d') {
    var pc_components = pc.split('%');
    pc_components[2] = "d";
    const pc_default_subsubindex = pc_components.join('%');

    ir_linename = line_column_map_get_value_for_pc(ir_linename_map, pc_default_subsubindex, "ir_linename");
  } else {
    ir_linename = ""; //unused
  }
  return [ir_linename, default_columnname_for_ir];
}

function tfg_asm_obtain_subprogram_info(tfg_asm, assembly)
{
  return {line: 0, scope_line: 0};
}

function tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc)
{
  var src_linename, src_columnname, src_line_and_column_names;

  const src_linename_map = src_tfg_llvm["linename_map"];
  const src_columnname_map = src_tfg_llvm["columnname_map"];
  const src_line_and_column_names_map = src_tfg_llvm["line_and_column_names_map"];

  const src_index = src_pc.split('%')[0];
  if (src_pc === 'L0%0%d') {
    src_linename = ""; //unused
    src_columnname = ""; //unused
    src_line_and_column_names = src_linename; //unused
  } else if (src_index.charAt(0) === 'L') {
    var pc_components = src_pc.split('%');
    pc_components[2] = "d";
    const src_pc_default_subsubindex = pc_components.join('%');

    const linename_prefix = "line ";
    src_linename = line_column_map_get_value_for_pc(src_linename_map, src_pc_default_subsubindex, "linename");
    src_linename = src_linename.substring(linename_prefix.length);

    const columnname_prefix = " at column ";
    src_columnname = line_column_map_get_value_for_pc(src_columnname_map, src_pc_default_subsubindex, "columnname");
    src_columnname = src_columnname.substring(columnname_prefix.length);

    src_line_and_column_names = line_column_map_get_value_for_pc(src_line_and_column_names_map, src_pc_default_subsubindex, "line_and_column_names");
    //if (src_linename === undefined) {
    //  console.log(`src_pc_default_subsubindex = ${src_pc_default_subsubindex}\n`);
    //  console.log("src_linename_map =\n");
    //  for (let [key, value] of src_linename_map.entries()) {
    //  	console.log(key + " = " + value)
    //  }
    //}
  } else {
    src_linename = ""; //unused
    src_columnname = ""; //unused
    src_line_and_column_names = src_linename; //unused
  }
  return [src_linename, src_columnname, src_line_and_column_names];
}

function dst_asm_compute_index_to_line_map_helper(index, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map)
{
  const dst_pc = dst_insn_pcs[index];
  if (dst_pc in dst_pc_to_assembly_index_map) {
    const assembly_index = dst_pc_to_assembly_index_map[dst_pc];
    if (assembly_index in dst_assembly_index_to_assembly_line_map) {
      const assembly_line = dst_assembly_index_to_assembly_line_map[assembly_index];
      //console.log(`index ${index}, dst_pc ${dst_pc}, assembly_index ${assembly_index}, assembly_line ${assembly_line}\n`);
      return assembly_line;
    }
  }
  return undefined;
}

function dst_asm_compute_index_to_line_map(dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map)
{
  var ret = {};
  for (var oi in dst_insn_pcs) {
    var found = false;
    //console.log(`looking at insn index ${oi}\n`);
    for (var i = oi; i < dst_insn_pcs.length; i++) {
      const linename = dst_asm_compute_index_to_line_map_helper(i, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map);
      if (linename !== undefined) {
        ret[oi] = linename;
        found = true;
        break;
      }
    }
    if (found) {
      continue;
    }
    for (var i = oi; i >= 0; i--) {
      const linename = dst_asm_compute_index_to_line_map_helper(i, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map);
      if (linename !== undefined) {
        ret[oi] = linename;
        found = true;
        break;
      }
    }
    if (!found) {
      ret[oi] = 0; //this should not be reached
    }
  }
  //console.log(`computed index_to_assembly_line_map (size ${ret.length}) =\n`);
  //for (var key in ret) {
  //  const val = ret[key];
  //  console.log(`${key} -> ${val}`);
  //}
  return ret;
}

function tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map)
{
  var dst_linename, dst_columnname, dst_line_and_column_names;
  const dst_index = dst_pc.split('%')[0];
  if (dst_pc === 'L0%0%d') {
    dst_linename = ""; //unused
    dst_columnname = ""; //unused
    dst_line_and_column_names = dst_linename; //unused
  } else if (dst_index.charAt(0) === 'L') {
    const index_name = dst_index.substring(1);
    dst_linename = dst_insn_index_to_assembly_line_map[index_name];
    dst_columnname = default_columnname_for_assembly;
    dst_line_and_column_names = dst_linename + dst_columnname;
  } else {
    dst_linename = ""; //unused
    dst_columnname = ""; //unused
    dst_line_and_column_names = dst_linename; //unused
  }
  return [dst_linename, dst_columnname, dst_line_and_column_names];
}

function get_ir_node_map(proptree_nodes, tfg_llvm)
{
  var ret = {};
  proptree_nodes.forEach(element => {
    var linename, columnname;
    if (tfg_llvm !== undefined) {
      [linename, columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(tfg_llvm, element.pc);
    }
    const entry = {pc: element.pc, linename: linename, columnname: columnname};
    ret[entry.pc] = entry;
  });
  return ret;
}

function get_src_dst_node_map(proptree_nodes, tfg_llvm, tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map)
{
  var ret = {};
  //if (tfg_llvm === null) {
  //  ret["syntax_type"] = "asm";
  //} else {
  //  ret["syntax_type"] = "C/llvm";
  //}
  proptree_nodes.forEach(element => {
    var linename, columnname, line_and_column_names;
    if (tfg_llvm === undefined) {
      [linename, columnname, line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(tfg_asm, element.pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
    } else {
      [linename, columnname, line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(tfg_llvm, element.pc);
    }
    const entry = {pc: element.pc, linename: linename, columnname: columnname, line_and_column_names: line_and_column_names};
    ret[entry.pc] = entry;
  });
  return ret;
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

  const [src_subprogram_info, src_ir_subprogram_info] = tfg_llvm_obtain_subprogram_info(src_tfg_llvm);
  var dst_subprogram_info, dst_ir_subprogram_info;
  if (dst_tfg_llvm === undefined) {
    dst_subprogram_info = tfg_asm_obtain_subprogram_info(dst_tfg_asm, dst_assembly);
  } else {
    [dst_subprogram_info, dst_ir_subprogram_info] = tfg_llvm_obtain_subprogram_info(dst_tfg_llvm);
  }

  var idx = 0;
  nodes_in.forEach(element => {
    const src_pc = element.pc.split('_')[0];
    const dst_pc = element.pc.split('_')[1];

    const [src_linename, src_columnname, src_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc);
    const [src_ir_linename, src_ir_columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(src_tfg_llvm, src_pc);

    var dst_linename, dst_columnname, dst_line_and_column_names;
    var dst_ir_linename, dst_ir_columnname;
    if (dst_tfg_llvm === undefined) {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
    } else {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
      [dst_ir_linename, dst_ir_columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
    }
    //console.log(`element.pc = ${element.pc}, src_pc = ${src_pc}, dst_pc = ${dst_pc}, src_linename = ${src_linename}, src_columnname = ${src_columnname}, src_line_and_column_names = ${src_line_and_column_names}, dst_linename = ${dst_linename}, dst_columnname = ${dst_columnname}, dst_line_and_column_names = ${dst_line_and_column_names}\n`);

    //const label = src_line_and_column_names + " ; " + dst_line_and_column_names;
    const label = "dst.l" + dst_linename;

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

  const src_nodeMap = get_src_dst_node_map(src_nodes, src_tfg_llvm, undefined, undefined, undefined, undefined, undefined);
  const src_ir_nodeMap = get_ir_node_map(src_nodes, src_tfg_llvm);
  const dst_nodeMap = get_src_dst_node_map(dst_nodes, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
  const dst_ir_nodeMap = get_ir_node_map(dst_nodes, dst_tfg_llvm);

  cg_edges.forEach(element => {
    const from_pc = element.edge.from_pc;
    const to_pc = element.edge.to_pc;

    //console.log(`element.dst_edge = ${JSON.stringify(element.dst_edge)}\n`);
    const dst_from_pc = element.dst_edge.from_pc;
    const dst_to_pc = element.dst_edge.to_pc;
    const dst_unroll_factor_mu = element.dst_edge.unroll_factor_mu;
    const dst_unroll_factor_delta = element.dst_edge.unroll_factor_delta.unroll;
    const dst_ec = element.dst_edge.graph_ec;

    const src_from_pc = element.src_edge.from_pc;
    const src_to_pc = element.src_edge.to_pc;
    const src_unroll_factor_mu = element.src_edge.unroll_factor_mu;
    const src_unroll_factor_delta = element.src_edge.unroll_factor_delta.unroll;
    const src_ec = element.src_edge.graph_ec;

    const src_entry = { from_pc: src_from_pc, to_pc: src_to_pc, unroll_factor_mu: src_unroll_factor_mu, unroll_factor_delta: src_unroll_factor_delta, ec: src_ec };
    const dst_entry = { from_pc: dst_from_pc, to_pc: dst_to_pc, unroll_factor_mu: dst_unroll_factor_mu, unroll_factor_delta: dst_unroll_factor_delta, ec: dst_ec };

    const edgeId = getEdgeId(from_pc, to_pc);
    const entry = { from_pc: from_pc, to_pc: to_pc, dst_edge: dst_entry, src_edge: src_entry };
    edgeMap[edgeId] = entry;
    //console.log(`Adding to edgeMap at index ${JSON.stringify(edgeId)}, entry ${entry}\n`);
  });

  return [nodeMap, nodeIdMap, edgeMap, src_subprogram_info, src_ir_subprogram_info, dst_subprogram_info, dst_ir_subprogram_info, src_nodeMap, src_ir_nodeMap, dst_nodeMap, dst_ir_nodeMap];
}

function convert_long_long_map_json_to_associative_array(long_long_map_json)
{
  var ret = {};
  const pairs = long_long_map_json.long_long_pair;
  if (pairs === undefined) {
    return {};
  }
  for (var i = 0; i < pairs.length; i++) {
    ret[pairs[i].long_val_key] = pairs[i].long_val_value;
  }
  return ret;
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

function drawNetwork(correl_entry) {

    //var nodeMap = {};
    //var idx = 0;
    //console.log(`drawNetwork: prod_cfg =\n${JSON.stringify(cfg)}\n`);
    //const graph_hierarchy = cfg["graph-hierarchy"];

    const cg_ec = correl_entry["cg_ec"];

    const graph_hierarchy = correl_entry["cg"];
    const graph = graph_hierarchy["graph"];
    const graph_with_predicates = graph_hierarchy["graph_with_predicates"];
    const nodes_in = graph["nodes"];
    const edges_in = graph["edges"];
    const cg_edges = graph_with_predicates["edge"];
    const corr_graph = graph_hierarchy["corr_graph"];
    const src_tfg = corr_graph["src_tfg"];
    const dst_tfg = corr_graph["dst_tfg"];

    const src_nodes = src_tfg["graph"]["nodes"];
    const dst_nodes = dst_tfg["graph"]["nodes"];

    const src_tfg_llvm = src_tfg["tfg_llvm"];

    const dst_tfg_llvm = dst_tfg["tfg_llvm"];
    const dst_tfg_asm = dst_tfg["tfg_asm"];

    const eqcheck_info = corr_graph["eqcheck_info"];
    //console.log(`eqcheck_info = ${JSON.stringify(eqcheck_info)}\n`);
    const dst_assembly = eqcheck_info["dst_assembly"];
    const dst_insn_pcs = (dst_assembly==="") ? undefined : convert_long_long_map_json_to_associative_array(eqcheck_info["dst_insn_pcs"]);
    const dst_pc_to_assembly_index_map = (dst_assembly==="") ? undefined : convert_long_long_map_json_to_associative_array(eqcheck_info["dst_pc_to_assembly_index_map"]);
    const dst_assembly_index_to_assembly_line_map = (dst_assembly==="") ? undefined : convert_long_long_map_json_to_associative_array(eqcheck_info["dst_assembly_index_to_assembly_line_map"]);

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

    const dst_insn_index_to_assembly_line_map = (dst_assembly==="") ? undefined : dst_asm_compute_index_to_line_map(dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map);

    //console.log(`dst_insn_index_to_assembly_line_map =\n`);
    //for (var key in dst_insn_index_to_assembly_line_map) {
    //  const val = dst_insn_index_to_assembly_line_map[key];
    //  console.log(`${key} -> ${val}`);
    //}

    [g_nodeMap, g_nodeIdMap, g_edgeMap, g_src_subprogram_info, g_src_ir_subprogram_info, g_dst_subprogram_info, g_dst_ir_subprogram_info, g_src_nodeMap, g_src_ir_nodeMap, g_dst_nodeMap, g_dst_ir_nodeMap] = getNodesEdgesMap(nodes_in, src_nodes, dst_nodes, cg_edges, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);

    //console.log(`g_nodeMap = ${JSON.stringify(g_nodeMap)}`);
    var nodes = new vis.DataSet(nodes_in.map(function(node) {
      const label_orig = g_nodeMap[node.pc].label;
      //console.log(`label_orig = ${label_orig}`);
      var label = label_orig;
      const level = g_nodeMap[node.pc].level;
      //var x = ((level % 2) * 2 - 1) * 500;
      //console.log(`node = ${node.pc}, level = ${level}, x = ${x}`);
      if (node.pc === 'L0%0%d_L0%0%d') {
        label = "entry";
      } else if (node.pc.charAt(0) !== 'L') {
        label = "exit";
      }
      return {id:g_nodeMap[node.pc].idx, label: label, level: level};
    }));
    var edges = new vis.DataSet(edges_in.map(function(edge) {
      const from_idx = g_nodeMap[edge.from_pc].idx;
      const to_idx = g_nodeMap[edge.to_pc].idx;
      const src_linename_from = g_nodeMap[edge.from_pc].src_node.linename;
      const dst_linename_from = g_nodeMap[edge.from_pc].dst_node.linename;
      const src_columnname_from = g_nodeMap[edge.from_pc].src_node.columnname;
      const dst_columnname_from = g_nodeMap[edge.from_pc].dst_node.columnname;

      const src_linename_to = g_nodeMap[edge.to_pc].src_node.linename;
      const dst_linename_to = g_nodeMap[edge.to_pc].dst_node.linename;
      const src_columnname_to = g_nodeMap[edge.to_pc].src_node.columnname;
      const dst_columnname_to = g_nodeMap[edge.to_pc].dst_node.columnname;

      var from_label = `(${src_linename_from}c${src_columnname_from}, ${dst_linename_from}c${dst_columnname_from})`;
      var to_label = `(${src_linename_to}c${src_columnname_to},${dst_linename_to}c${dst_columnname_to})`;

      if (edge.from_pc === 'L0%0%d_L0%0%d') {
        from_label = "entry";
      }
      if (edge.to_pc.charAt(0) !== 'L') {
        to_label = "exit";
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
      return {from: from_idx, to: to_idx, color: color/*, label: label*/};
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

    return network; //nodeMap:g_nodeMap
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
          src_subprogram_info: g_src_subprogram_info,
          src_ir_subprogram_info: g_src_ir_subprogram_info,
          dst_subprogram_info: g_dst_subprogram_info,
          dst_ir_subprogram_info: g_dst_ir_subprogram_info,
          src_nodeMap: g_src_nodeMap,
          src_ir_nodeMap: g_src_ir_nodeMap,
          dst_nodeMap: g_dst_nodeMap,
          dst_ir_nodeMap: g_dst_ir_nodeMap
      });
  });

  network.on('deselectEdge', function(properties) {
      vscode.postMessage({
          command:"clear"
      });
  });
}
