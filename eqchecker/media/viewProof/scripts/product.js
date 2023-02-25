/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

const vscode = acquireVsCodeApi();

var prod_cfg = null;

window.addEventListener('message', async event => {
    const message = event.data;
    //console.log(`RECEIVED EVENT: ${JSON.stringify(message)}\n`);
    switch (message.command) {
      case 'showProof':
        prod_cfg = message.code;
        //prod_cfg = message;
        //console.log(`prod_cfg = ${prod_cfg}`);
        //console.log("RECEIVED showProof\n");
        break;
    }
});

async function waitForMessage(){
    while(prod_cfg === null){
        console.log("prod_cfg is still NULL");
        await new Promise(r => window.setTimeout(r, 1000));
    }
}
vscode.postMessage({command:"loaded"});

//console.log("Waiting for proof\n");
await waitForMessage();
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

function tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc)
{
  var src_linename, src_columnname, src_line_and_column_names;

  const src_linename_map = src_tfg_llvm["linename_map"];
  const src_columnname_map = src_tfg_llvm["columnname_map"];
  const src_line_and_column_names_map = src_tfg_llvm["line_and_column_names_map"];

  const src_index = src_pc.split('%')[0];
  if (src_pc === 'L0%0%d') {
    src_linename = 'entry';
    src_columnname = "";
    src_line_and_column_names = src_linename;
  } else if (src_index.charAt(0) === 'L') {
    var pc_components = src_pc.split('%');
    pc_components[2] = "d";
    const src_pc_default_subsubindex = pc_components.join('%');
    src_linename = line_column_map_get_value_for_pc(src_linename_map, src_pc_default_subsubindex, "linename");
    src_columnname = line_column_map_get_value_for_pc(src_columnname_map, src_pc_default_subsubindex, "columnname");
    src_line_and_column_names = line_column_map_get_value_for_pc(src_line_and_column_names_map, src_pc_default_subsubindex, "line_and_column_names");
    //if (src_linename === undefined) {
    //  console.log(`src_pc_default_subsubindex = ${src_pc_default_subsubindex}\n`);
    //  console.log("src_linename_map =\n");
    //  for (let [key, value] of src_linename_map.entries()) {
    //  	console.log(key + " = " + value)
    //  }
    //}
  } else {
    src_linename = 'exit';
    src_columnname = "";
    src_line_and_column_names = src_linename;
  }
  return [src_linename, src_columnname, src_line_and_column_names];
}

function tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc)
{
  var dst_linename, dst_columnname, dst_line_and_column_names;
  const dst_index = dst_pc.split('%')[0];
  if (dst_pc === 'L0%0%d') {
    dst_linename = 'entry';
    dst_columnname = "";
    dst_line_and_column_names = dst_linename;
  } else if (dst_index.charAt(0) === 'L') {
    dst_linename = dst_index.substring(1);
    dst_columnname = "0"
    dst_line_and_column_names = dst_linename + "c0";
  } else {
    dst_linename = 'exit';
    dst_columnname = "";
    dst_line_and_column_names = dst_linename;
  }
  return [dst_linename, dst_columnname, dst_line_and_column_names];
}

function getNodesMap(nodes_in, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm)
{
  var nodeMap = {};
  var idx = 0;
  nodes_in.forEach(element => {
    const src_pc = element.pc.split('_')[0];
    const dst_pc = element.pc.split('_')[1];

    const [src_linename, src_columnname, src_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc);

    var dst_linename, dst_columnname, dst_line_and_column_names;
    if (dst_tfg_llvm === undefined) {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc);
    } else {
      [dst_linename, dst_columnname, dst_line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(dst_tfg_llvm, dst_pc);
    }
    console.log(`element.pc = ${element.pc}, src_pc = ${src_pc}, dst_pc = ${dst_pc}, src_linename = ${src_linename}, src_columnname = ${src_columnname}, src_line_and_column_names = ${src_line_and_column_names}, dst_linename = ${dst_linename}, dst_columnname = ${dst_columnname}, dst_line_and_column_names = ${dst_line_and_column_names}\n`);

    const label = src_line_and_column_names + " ; " + dst_line_and_column_names;
    nodeMap[element.pc] = {idx: idx, src_pc: src_pc, dst_pc: dst_pc, src_linename: src_linename, columnname: src_columnname, line_and_column_names: src_line_and_column_names, dst_linename: dst_linename, dst_columnname: dst_columnname, dst_line_and_column_names: dst_line_and_column_names, label: label};
    idx++;
  });
  return nodeMap;
}

function drawNetwork(cfg) {

    //var nodeMap = {};
    //var idx = 0;
    //console.log(`drawNetwork: prod_cfg =\n${JSON.stringify(cfg)}\n`);
    const graph_hierarchy = cfg["graph-hierarchy"];
    const graph = graph_hierarchy["graph"];
    const nodes_in = graph["nodes"];
    const edges_in = graph["edges"];
    const corr_graph = graph_hierarchy["corr_graph"];
    const src_tfg = corr_graph["src_tfg"];
    const dst_tfg = corr_graph["dst_tfg"];

    const src_tfg_llvm = src_tfg["tfg_llvm"];

    const dst_tfg_llvm = dst_tfg["tfg_llvm"];
    const dst_tfg_asm = dst_tfg["tfg_asm"];

    const nodeMap = getNodesMap(nodes_in, src_tfg_llvm, dst_tfg_llvm, dst_tfg_asm);

    var nodes = new vis.DataSet(nodes_in.map(function(node) {return {id:nodeMap[node.pc].idx, label:nodeMap[node.pc].label};}));
    var edges = new vis.DataSet(edges_in.map(function(edge) {return {from:nodeMap[edge.from_pc].idx, to:nodeMap[edge.to_pc].idx, label:""/*edge.path1 + '\n\n' +edge.path2*/};}));

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
                forceDirection: "vertical"
            },
            font: {
                align: 'horizontal',
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
                enabled: true,
                levelSeparation: 300,
                nodeSpacing: 200,
                // shakeTowards: "leaves"
            }
        },
        physics: {
            enabled: false,
            // solver: "hierarchicalRepulsion"
        }
    });

    return {network:network, nodeMap:nodeMap};
}

initializeContainer();
var res = drawNetwork(prod_cfg);

var network = res.network;
var nodeMap = res.nodeMap;

network.on('selectEdge', function(properties) {
    let edgeId = properties.edges[0];
    let edge = network.body.data.edges.get(edgeId);

    var from = prod_cfg["nodes"][edge.from];
    var to = prod_cfg["nodes"][edge.to];
    var path1 = edge.label.split('\n\n')[0];
    var path2 = edge.label.split('\n\n')[1];

    vscode.postMessage({
        command:"highlight",
        from: from,
        to: to,
        path1: path1,
        path2: path2
    });
});

network.on('deselectEdge', function(properties) {
    vscode.postMessage({
        command:"clear"
    });
});
